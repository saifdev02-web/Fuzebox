"""Run endpoints — POST /run/v1, POST /run/v2."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..agents.pipeline import run_pipeline
from ..agents.config import V1_DEFAULTS, V2_PRESETS

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/run", tags=["runs"])


class RunRequest(BaseModel):
    """Request body for triggering a pipeline run."""

    input_text: str = Field(
        ..., min_length=1, max_length=5000, description="Service request text"
    )
    tuning_params: dict | None = Field(
        None, description="Override tuning parameters (V2 only)"
    )
    iteration: int = Field(1, ge=1, le=10, description="Iteration number (1–10)")


class RunResponse(BaseModel):
    """Response from a pipeline run."""

    run_id: str
    run_version: str
    iteration: int
    classification: dict
    triage: dict
    draft: dict
    telemetry_summary: dict


@router.post("/v1", response_model=RunResponse)
@limiter.limit(settings.rate_limit_run)
async def run_v1(
    body: RunRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Run V1 baseline pipeline (one-shot, default settings)."""
    try:
        final_state, collector = await run_pipeline(
            input_text=body.input_text,
            run_version="v1",
            iteration=body.iteration,
        )
        await collector.flush(db)
        await db.commit()

        return RunResponse(
            run_id=final_state["run_id"],
            run_version="v1",
            iteration=body.iteration,
            classification=final_state.get("classification", {}),
            triage=final_state.get("triage", {}),
            draft=final_state.get("draft", {}),
            telemetry_summary={
                "agents_run": 3,
                "total_latency_ms": sum(
                    final_state.get(f"agent_{i}_latency_ms", 0) for i in ["1", "2", "3"]
                ),
                "total_input_tokens": sum(
                    final_state.get(f"agent_{i}_input_tokens", 0) for i in ["1", "2", "3"]
                ),
                "total_output_tokens": sum(
                    final_state.get(f"agent_{i}_output_tokens", 0) for i in ["1", "2", "3"]
                ),
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


@router.post("/v2", response_model=RunResponse)
@limiter.limit(settings.rate_limit_run)
async def run_v2(
    body: RunRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Run V2 tuned pipeline (ReAct pattern, tuned settings)."""
    try:
        final_state, collector = await run_pipeline(
            input_text=body.input_text,
            run_version="v2",
            tuning_params=body.tuning_params,
            iteration=body.iteration,
        )
        await collector.flush(db)
        await db.commit()

        # Include reflection info in summary
        reflections = {}
        for i, name in [("1", "classify"), ("2", "triage"), ("3", "draft")]:
            reflections[name] = {
                "was_corrected": final_state.get(f"reflect_{i}_corrected", False),
                "latency_ms": final_state.get(f"reflect_{i}_latency_ms", 0),
            }

        return RunResponse(
            run_id=final_state["run_id"],
            run_version="v2",
            iteration=body.iteration,
            classification=final_state.get("classification", {}),
            triage=final_state.get("triage", {}),
            draft=final_state.get("draft", {}),
            telemetry_summary={
                "agents_run": 6,
                "total_latency_ms": sum(
                    final_state.get(f"agent_{i}_latency_ms", 0) for i in ["1", "2", "3"]
                ) + sum(
                    final_state.get(f"reflect_{i}_latency_ms", 0) for i in ["1", "2", "3"]
                ),
                "total_input_tokens": sum(
                    final_state.get(f"agent_{i}_input_tokens", 0) for i in ["1", "2", "3"]
                ) + sum(
                    final_state.get(f"reflect_{i}_input_tokens", 0) for i in ["1", "2", "3"]
                ),
                "total_output_tokens": sum(
                    final_state.get(f"agent_{i}_output_tokens", 0) for i in ["1", "2", "3"]
                ) + sum(
                    final_state.get(f"reflect_{i}_output_tokens", 0) for i in ["1", "2", "3"]
                ),
                "reflections": reflections,
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")
