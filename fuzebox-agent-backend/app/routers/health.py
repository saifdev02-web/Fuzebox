"""Health check and usage summary endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.telemetry import AgentTelemetry

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Check DB connectivity and return service status."""
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "service": "fuzebox-agent-backend",
        "version": "2.0.0",
    }


@router.get("/usage-summary")
async def usage_summary(db: AsyncSession = Depends(get_db)):
    """Return aggregate usage stats across all runs."""
    total_runs = await db.scalar(
        select(func.count(func.distinct(AgentTelemetry.run_id)))
    )
    total_rows = await db.scalar(select(func.count(AgentTelemetry.id)))
    total_cost = await db.scalar(select(func.sum(AgentTelemetry.cost_usd))) or 0.0
    total_tokens = (
        await db.scalar(
            select(
                func.sum(AgentTelemetry.input_tokens + AgentTelemetry.output_tokens)
            )
        )
        or 0
    )

    return {
        "total_runs": total_runs or 0,
        "total_telemetry_rows": total_rows or 0,
        "total_cost_usd": round(total_cost, 4),
        "total_tokens": total_tokens,
    }
