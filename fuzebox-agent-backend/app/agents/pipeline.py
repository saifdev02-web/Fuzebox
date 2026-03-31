"""LangGraph pipeline — 3-agent sequential graph with V1/V2 mode switching."""

import uuid
from typing import Any

from langgraph.graph import StateGraph, END

from ..config import settings
from ..telemetry.callback import TelemetryCollector
from .config import V1_DEFAULTS, V2_PRESETS, AGENT_NAMES, AGENT_TASK_TYPES
from .nodes import classify_node, triage_node, draft_node
from .react_nodes import reflect_classify, reflect_triage, reflect_draft


# ── State type ───────────────────────────────────────────────────────────

PipelineState = dict[str, Any]


# ── V1 Graph: One-shot (classify -> triage -> draft) ─────────────────────

def build_v1_graph() -> StateGraph:
    """Build the V1 pipeline: 3 agents, no reflection, one-shot."""
    graph = StateGraph(dict)

    graph.add_node("classify", classify_node)
    graph.add_node("triage", triage_node)
    graph.add_node("draft", draft_node)

    graph.add_edge("classify", "triage")
    graph.add_edge("triage", "draft")
    graph.add_edge("draft", END)

    graph.set_entry_point("classify")
    return graph


# ── V2 Graph: ReAct (classify -> reflect -> triage -> reflect -> draft -> reflect)

def build_v2_graph() -> StateGraph:
    """Build the V2 pipeline: 3 agents + 3 reflection nodes."""
    graph = StateGraph(dict)

    graph.add_node("classify", classify_node)
    graph.add_node("reflect_classify", reflect_classify)
    graph.add_node("triage", triage_node)
    graph.add_node("reflect_triage", reflect_triage)
    graph.add_node("draft", draft_node)
    graph.add_node("reflect_draft", reflect_draft)

    graph.add_edge("classify", "reflect_classify")
    graph.add_edge("reflect_classify", "triage")
    graph.add_edge("triage", "reflect_triage")
    graph.add_edge("reflect_triage", "draft")
    graph.add_edge("draft", "reflect_draft")
    graph.add_edge("reflect_draft", END)

    graph.set_entry_point("classify")
    return graph


# Compile once at module level
v1_pipeline = build_v1_graph().compile()
v2_pipeline = build_v2_graph().compile()


# ── Pipeline runner ──────────────────────────────────────────────────────

async def run_pipeline(
    input_text: str,
    run_version: str,
    tuning_params: dict | None = None,
    iteration: int = 1,
    model_name: str | None = None,
) -> tuple[dict, TelemetryCollector]:
    """Run the full 3-agent pipeline (V1 or V2) and collect telemetry.

    Returns (final_state, telemetry_collector).
    """
    run_id = uuid.uuid4()
    model = model_name or settings.openai_model

    # Select defaults based on version
    if run_version == "v1":
        pipeline = v1_pipeline
        defaults = V1_DEFAULTS
    else:
        pipeline = v2_pipeline
        defaults = V2_PRESETS

    # Merge agent-specific defaults — use provided params or fallback
    merged_params = {}
    if tuning_params:
        merged_params = tuning_params
    else:
        # Flatten all defaults into one dict (each node reads what it needs)
        for agent_defaults in defaults.values():
            merged_params.update(agent_defaults)

    # Build initial state
    initial_state: PipelineState = {
        "input_text": input_text,
        "run_id": str(run_id),
        "run_version": run_version,
        "iteration": iteration,
        "tuning_params": merged_params,
        "model_name": model,
    }

    # Run the pipeline
    final_state = await pipeline.ainvoke(initial_state)

    # Collect telemetry from final state
    collector = TelemetryCollector(
        run_id=run_id,
        run_version=run_version,
        iteration=iteration,
        tuning_params=merged_params,
        model_name=model,
    )

    # Record agent telemetry rows
    agents = [
        ("intake_classifier", "1"),
        ("triage_scorer", "2"),
        ("response_drafter", "3"),
    ]

    for agent_id, agent_num in agents:
        status = final_state.get(f"agent_{agent_num}_status", "unknown")
        collector.record(
            agent_id=agent_id,
            agent_name=AGENT_NAMES[agent_id],
            task_type=AGENT_TASK_TYPES[agent_id],
            input_text=input_text,
            output_text=final_state.get(f"agent_{agent_num}_output", ""),
            input_tokens=final_state.get(f"agent_{agent_num}_input_tokens", 0),
            output_tokens=final_state.get(f"agent_{agent_num}_output_tokens", 0),
            latency_ms=final_state.get(f"agent_{agent_num}_latency_ms", 0),
            completion_status=status,
            escalation_flag=status == "failure",
        )

        # Record reflection telemetry for V2
        if run_version == "v2" and f"reflect_{agent_num}_output" in final_state:
            collector.record(
                agent_id=f"{agent_id}_reflect",
                agent_name=f"{AGENT_NAMES[agent_id]} (Reflect)",
                task_type=f"{AGENT_TASK_TYPES[agent_id]}_reflection",
                input_text=final_state.get(f"agent_{agent_num}_output", ""),
                output_text=final_state.get(f"reflect_{agent_num}_output", ""),
                input_tokens=final_state.get(f"reflect_{agent_num}_input_tokens", 0),
                output_tokens=final_state.get(f"reflect_{agent_num}_output_tokens", 0),
                latency_ms=final_state.get(f"reflect_{agent_num}_latency_ms", 0),
                completion_status="success",
                metadata={
                    "was_corrected": final_state.get(
                        f"reflect_{agent_num}_corrected", False
                    )
                },
            )

    return final_state, collector
