"""Tuning parameter endpoints — read/write per-agent dials."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.tuning import TuningParameters
from ..agents.config import V1_DEFAULTS, V2_PRESETS

router = APIRouter(prefix="/tuning-params", tags=["tuning"])


class TuningParamsRequest(BaseModel):
    """Request body for setting tuning parameters."""

    agent_id: str = Field(..., description="Agent identifier")
    prompt_precision: int = Field(40, ge=0, le=100)
    confidence_threshold: float = Field(0.5, ge=0.0, le=1.0)
    fallback_depth: int = Field(1, ge=1, le=5)
    data_prefetch: bool = Field(False)
    sentiment_weight: float = Field(0.0, ge=0.0, le=1.0)
    tone_variant: str = Field("professional")


class TuningParamsResponse(BaseModel):
    """Response with current tuning parameters."""

    id: int
    agent_id: str
    version: int
    prompt_precision: int
    confidence_threshold: float
    fallback_depth: int
    data_prefetch: bool
    sentiment_weight: float
    tone_variant: str
    is_active: bool


@router.get("/")
async def get_all_tuning_params(db: AsyncSession = Depends(get_db)):
    """Get current active tuning parameters for all agents."""
    result = await db.execute(
        select(TuningParameters).where(TuningParameters.is_active == True)
    )
    rows = result.scalars().all()

    if not rows:
        # Return defaults if nothing saved yet
        return {
            "params": {
                agent_id: {**defaults, "version": 1, "is_active": True}
                for agent_id, defaults in V2_PRESETS.items()
            },
            "source": "defaults",
        }

    return {
        "params": {
            r.agent_id: {
                "id": r.id,
                "version": r.version,
                "prompt_precision": r.prompt_precision,
                "confidence_threshold": r.confidence_threshold,
                "fallback_depth": r.fallback_depth,
                "data_prefetch": r.data_prefetch,
                "sentiment_weight": r.sentiment_weight,
                "tone_variant": r.tone_variant,
                "is_active": r.is_active,
            }
            for r in rows
        },
        "source": "database",
    }


@router.get("/presets")
async def get_presets():
    """Return V1 default and V2 recommended presets."""
    return {
        "v1_defaults": V1_DEFAULTS,
        "v2_presets": V2_PRESETS,
    }


@router.get("/{agent_id}")
async def get_agent_tuning(
    agent_id: str, db: AsyncSession = Depends(get_db)
):
    """Get active tuning parameters for a specific agent."""
    result = await db.execute(
        select(TuningParameters)
        .where(TuningParameters.agent_id == agent_id)
        .where(TuningParameters.is_active == True)
        .order_by(TuningParameters.version.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()

    if not row:
        # Return V2 preset as default
        preset = V2_PRESETS.get(agent_id)
        if not preset:
            raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id}")
        return {**preset, "agent_id": agent_id, "version": 0, "source": "preset"}

    return {
        "id": row.id,
        "agent_id": row.agent_id,
        "version": row.version,
        "prompt_precision": row.prompt_precision,
        "confidence_threshold": row.confidence_threshold,
        "fallback_depth": row.fallback_depth,
        "data_prefetch": row.data_prefetch,
        "sentiment_weight": row.sentiment_weight,
        "tone_variant": row.tone_variant,
        "is_active": row.is_active,
        "source": "database",
    }


@router.post("/{agent_id}")
async def set_agent_tuning(
    agent_id: str,
    body: TuningParamsRequest,
    db: AsyncSession = Depends(get_db),
):
    """Save new tuning parameters for an agent (creates a new version)."""
    if agent_id not in V2_PRESETS:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id}")

    # Deactivate previous active params
    await db.execute(
        update(TuningParameters)
        .where(TuningParameters.agent_id == agent_id)
        .where(TuningParameters.is_active == True)
        .values(is_active=False)
    )

    # Get latest version number
    result = await db.execute(
        select(TuningParameters.version)
        .where(TuningParameters.agent_id == agent_id)
        .order_by(TuningParameters.version.desc())
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    next_version = (latest or 0) + 1

    new_params = TuningParameters(
        agent_id=agent_id,
        version=next_version,
        prompt_precision=body.prompt_precision,
        confidence_threshold=body.confidence_threshold,
        fallback_depth=body.fallback_depth,
        data_prefetch=body.data_prefetch,
        sentiment_weight=body.sentiment_weight,
        tone_variant=body.tone_variant,
        is_active=True,
    )
    db.add(new_params)
    await db.flush()

    return {
        "id": new_params.id,
        "agent_id": agent_id,
        "version": next_version,
        "message": f"Tuning parameters v{next_version} saved for {agent_id}",
    }


@router.post("/reset/{agent_id}")
async def reset_agent_tuning(
    agent_id: str, db: AsyncSession = Depends(get_db)
):
    """Reset tuning parameters to V2 recommended presets."""
    if agent_id not in V2_PRESETS:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id}")

    # Deactivate all current
    await db.execute(
        update(TuningParameters)
        .where(TuningParameters.agent_id == agent_id)
        .where(TuningParameters.is_active == True)
        .values(is_active=False)
    )

    preset = V2_PRESETS[agent_id]
    new_params = TuningParameters(
        agent_id=agent_id,
        version=1,
        prompt_precision=preset["prompt_precision"],
        confidence_threshold=preset["confidence_threshold"],
        fallback_depth=preset["fallback_depth"],
        data_prefetch=preset["data_prefetch"],
        sentiment_weight=preset["sentiment_weight"],
        tone_variant=preset["tone_variant"],
        is_active=True,
    )
    db.add(new_params)
    await db.flush()

    return {
        "agent_id": agent_id,
        "message": f"Reset to V2 preset for {agent_id}",
        "params": preset,
    }
