"""Run endpoints — POST /run/v1, POST /run/v2, GET /run/test-inputs."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..agents.pipeline import run_pipeline
from ..agents.config import V1_DEFAULTS, V2_PRESETS
from ..evaluation.evaluator import score_classification, score_triage, score_draft
from ..evaluation.ground_truth import load_test_inputs, get_truth

logger = logging.getLogger(__name__)

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
    evaluation: dict | None = None


# ── Helpers ────────────────────────────────────────────────────────────────


def _find_test_input_id(input_text: str) -> str | None:
    """Try to match free-text input to a known test input (exact match)."""
    try:
        inputs = load_test_inputs()
        for inp in inputs:
            if inp["input_text"].strip() == input_text.strip():
                return inp["id"]
    except Exception:
        pass
    return None


def _calculate_row_auop(
    completion_status: str,
    accuracy_score: float | None,
    escalation_flag: bool,
    latency_ms: float,
    cost_usd: float,
) -> float:
    """Calculate AUoP for a single telemetry row (architecture doc §8 formula)."""
    cr = 1.0 if completion_status == "success" else 0.0
    acc = accuracy_score if accuracy_score is not None else 0.5  # neutral default
    esc = 1.0 if escalation_flag else 0.0
    speed = max(0.0, 1 - latency_ms / 30000)
    cost_eff = max(0.0, 1 - cost_usd / 1.0)
    return round(
        0.35 * cr + 0.25 * acc + 0.20 * (1 - esc) + 0.10 * speed + 0.10 * cost_eff,
        4,
    )


async def _evaluate_and_update(
    input_text: str,
    final_state: dict,
    collector,
    db: AsyncSession,
) -> dict | None:
    """Run evaluation if input matches a test case, then compute AUoP for every row."""
    request_id = _find_test_input_id(input_text)
    eval_results = None

    if request_id:
        truth = get_truth(request_id)
        if truth:
            try:
                # Agent 1 — programmatic classification scoring
                classification = final_state.get("classification", {})
                a1_acc = score_classification(classification, truth)

                # Agent 2 — programmatic triage scoring
                triage = final_state.get("triage", {})
                a2_acc = score_triage(triage, truth)

                # Agent 3 — programmatic draft scoring (fast, no extra LLM call)
                draft = final_state.get("draft", {})
                draft_eval = score_draft(draft, truth)
                a3_acc = draft_eval.get("overall_score", 0.5)

                eval_results = {
                    "request_id": request_id,
                    "agent_1_accuracy": a1_acc,
                    "agent_2_accuracy": a2_acc,
                    "agent_3_accuracy": a3_acc,
                    "agent_3_detail": draft_eval,
                    "overall_accuracy": round((a1_acc + a2_acc + a3_acc) / 3, 4),
                }

                # Write accuracy into the matching telemetry rows
                for row in collector.rows:
                    if row.agent_id == "intake_classifier":
                        row.accuracy_score = a1_acc
                    elif row.agent_id == "triage_scorer":
                        row.accuracy_score = a2_acc
                    elif row.agent_id == "response_drafter":
                        row.accuracy_score = a3_acc

            except Exception as e:
                logger.warning("Evaluation failed for %s: %s", request_id, e)

    # Calculate per-row AUoP for ALL rows (including non-test-input runs)
    for row in collector.rows:
        row.auop_score = _calculate_row_auop(
            row.completion_status,
            row.accuracy_score,
            row.escalation_flag,
            row.latency_ms,
            row.cost_usd,
        )

    await db.flush()
    return eval_results


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/test-inputs")
async def get_test_inputs_endpoint():
    """Return the list of test inputs available for running."""
    try:
        inputs = load_test_inputs()
        return {"inputs": inputs}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Could not load test inputs: {e}"
        )


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

        # Evaluate accuracy + compute AUoP
        eval_results = await _evaluate_and_update(
            body.input_text, final_state, collector, db
        )

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
                    final_state.get(f"agent_{i}_latency_ms", 0)
                    for i in ["1", "2", "3"]
                ),
                "total_input_tokens": sum(
                    final_state.get(f"agent_{i}_input_tokens", 0)
                    for i in ["1", "2", "3"]
                ),
                "total_output_tokens": sum(
                    final_state.get(f"agent_{i}_output_tokens", 0)
                    for i in ["1", "2", "3"]
                ),
            },
            evaluation=eval_results,
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

        # Evaluate accuracy + compute AUoP
        eval_results = await _evaluate_and_update(
            body.input_text, final_state, collector, db
        )

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
                    final_state.get(f"agent_{i}_latency_ms", 0)
                    for i in ["1", "2", "3"]
                )
                + sum(
                    final_state.get(f"reflect_{i}_latency_ms", 0)
                    for i in ["1", "2", "3"]
                ),
                "total_input_tokens": sum(
                    final_state.get(f"agent_{i}_input_tokens", 0)
                    for i in ["1", "2", "3"]
                )
                + sum(
                    final_state.get(f"reflect_{i}_input_tokens", 0)
                    for i in ["1", "2", "3"]
                ),
                "total_output_tokens": sum(
                    final_state.get(f"agent_{i}_output_tokens", 0)
                    for i in ["1", "2", "3"]
                )
                + sum(
                    final_state.get(f"reflect_{i}_output_tokens", 0)
                    for i in ["1", "2", "3"]
                ),
                "reflections": reflections,
            },
            evaluation=eval_results,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")
