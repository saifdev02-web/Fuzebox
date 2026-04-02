"""Telemetry read endpoints — per-agent metrics and V1/V2 comparison."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.telemetry import AgentTelemetry
from ..telemetry.metrics import (
    completion_rate,
    accuracy,
    escalation_rate,
    avg_task_time,
    auop_score,
    human_to_agent_ratio,
    rop,
    compute_delta,
)

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


def _rows_to_dicts(rows: list[AgentTelemetry]) -> list[dict]:
    """Convert ORM rows to plain dicts for metric functions."""
    return [
        {
            "id": r.id,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "run_id": str(r.run_id),
            "run_version": r.run_version,
            "iteration": r.iteration,
            "agent_id": r.agent_id,
            "agent_name": r.agent_name,
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "task_type": r.task_type,
            "completion_status": r.completion_status,
            "escalation_flag": r.escalation_flag,
            "latency_ms": r.latency_ms,
            "auop_score": r.auop_score,
            "accuracy_score": r.accuracy_score,
            "cost_usd": r.cost_usd,
            "model_name": r.model_name,
            "input_text": r.input_text,
            "output_text": r.output_text,
            "tuning_params": r.tuning_params,
        }
        for r in rows
    ]


@router.get("/{agent_id}")
async def get_agent_telemetry(
    agent_id: str,
    run_version: str | None = Query(None, description="Filter by v1 or v2"),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Get telemetry rows for a specific agent, optionally filtered by version."""
    query = select(AgentTelemetry).where(AgentTelemetry.agent_id == agent_id)
    if run_version:
        query = query.where(AgentTelemetry.run_version == run_version)
    query = query.order_by(AgentTelemetry.timestamp.desc()).limit(limit)

    result = await db.execute(query)
    rows = result.scalars().all()
    dicts = _rows_to_dicts(rows)

    return {
        "agent_id": agent_id,
        "run_version": run_version,
        "count": len(dicts),
        "metrics": {
            "completion_rate": completion_rate(dicts),
            "accuracy": accuracy(dicts),
            "escalation_rate": escalation_rate(dicts),
            "avg_task_time": avg_task_time(dicts),
            "auop": auop_score(dicts),
        },
        "rows": dicts,
    }


@router.get("/")
async def get_all_telemetry(
    run_version: str | None = Query(None),
    limit: int = Query(200, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
):
    """Get all telemetry rows, optionally filtered by version."""
    query = select(AgentTelemetry)
    if run_version:
        query = query.where(AgentTelemetry.run_version == run_version)
    query = query.order_by(AgentTelemetry.timestamp.desc()).limit(limit)

    result = await db.execute(query)
    rows = result.scalars().all()
    dicts = _rows_to_dicts(rows)

    return {
        "run_version": run_version,
        "count": len(dicts),
        "rows": dicts,
    }


@router.get("/comparison/delta")
async def comparison(db: AsyncSession = Depends(get_db)):
    """V1 vs V2 comparison — measured deltas from actual telemetry.

    Only includes the 3 main agents (excludes reflection telemetry rows)
    to prevent inflated V2 metrics.
    """
    main_agents = ["intake_classifier", "triage_scorer", "response_drafter"]
    v1_result = await db.execute(
        select(AgentTelemetry)
        .where(AgentTelemetry.run_version == "v1")
        .where(AgentTelemetry.agent_id.in_(main_agents))
    )
    v2_result = await db.execute(
        select(AgentTelemetry)
        .where(AgentTelemetry.run_version == "v2")
        .where(AgentTelemetry.agent_id.in_(main_agents))
    )

    v1_rows = _rows_to_dicts(v1_result.scalars().all())
    v2_rows = _rows_to_dicts(v2_result.scalars().all())

    if not v1_rows or not v2_rows:
        return {
            "error": "Need both V1 and V2 telemetry data to compute comparison",
            "v1_count": len(v1_rows),
            "v2_count": len(v2_rows),
        }

    delta = compute_delta(v1_rows, v2_rows)

    # Per-agent breakdown
    agent_ids = ["intake_classifier", "triage_scorer", "response_drafter"]
    per_agent = {}
    for aid in agent_ids:
        v1_agent = [r for r in v1_rows if r["agent_id"] == aid]
        v2_agent = [r for r in v2_rows if r["agent_id"] == aid]
        if v1_agent and v2_agent:
            per_agent[aid] = compute_delta(v1_agent, v2_agent)

    return {
        "overall": delta,
        "per_agent": per_agent,
        "v1_total_rows": len(v1_rows),
        "v2_total_rows": len(v2_rows),
    }
