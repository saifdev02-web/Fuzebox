"""ReAct reflection nodes for V2 agents — reason over output, self-correct."""

import json
import time

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from ..config import settings
from .prompts import REFLECT_CLASSIFIER, REFLECT_TRIAGE, REFLECT_DRAFTER
from .nodes import _parse_json, _get_llm


async def reflect_classify(state: dict) -> dict:
    """Reflect on classification output, self-correct if needed."""
    params = state.get("tuning_params", {})
    threshold = params.get("confidence_threshold", 0.75)
    temperature = params.get("temperature", 0.2)

    prompt = REFLECT_CLASSIFIER.format(
        previous_output=state.get("agent_1_output", ""),
        threshold=threshold,
    )

    llm = _get_llm(temperature=temperature)

    start = time.time()
    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content=f"Original request: {state['input_text']}"),
        ])
        latency_ms = (time.time() - start) * 1000
        parsed = _parse_json(response.content)

        usage = response.usage_metadata or {}

        # Update classification if corrected
        was_corrected = parsed.get("was_corrected", False)
        if was_corrected:
            state["classification"] = parsed

        return {
            **state,
            "classification": state.get("classification", parsed),
            "reflect_1_output": response.content,
            "reflect_1_corrected": was_corrected,
            "reflect_1_latency_ms": latency_ms,
            "reflect_1_input_tokens": usage.get("input_tokens", 0),
            "reflect_1_output_tokens": usage.get("output_tokens", 0),
        }
    except Exception as e:
        return {
            **state,
            "reflect_1_output": str(e),
            "reflect_1_corrected": False,
            "reflect_1_latency_ms": (time.time() - start) * 1000,
            "reflect_1_input_tokens": 0,
            "reflect_1_output_tokens": 0,
        }


async def reflect_triage(state: dict) -> dict:
    """Reflect on triage output, self-correct if needed."""
    params = state.get("tuning_params", {})
    temperature = params.get("temperature", 0.2)
    customer_context = state.get("customer_context", {})

    prompt = REFLECT_TRIAGE.format(
        previous_output=state.get("agent_2_output", ""),
        customer_context=json.dumps(customer_context) if customer_context else "N/A",
    )

    llm = _get_llm(temperature=temperature)

    start = time.time()
    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content=f"Original request: {state['input_text']}"),
        ])
        latency_ms = (time.time() - start) * 1000
        parsed = _parse_json(response.content)

        usage = response.usage_metadata or {}

        was_corrected = parsed.get("was_corrected", False)
        if was_corrected:
            state["triage"] = parsed

        return {
            **state,
            "triage": state.get("triage", parsed),
            "reflect_2_output": response.content,
            "reflect_2_corrected": was_corrected,
            "reflect_2_latency_ms": latency_ms,
            "reflect_2_input_tokens": usage.get("input_tokens", 0),
            "reflect_2_output_tokens": usage.get("output_tokens", 0),
        }
    except Exception as e:
        return {
            **state,
            "reflect_2_output": str(e),
            "reflect_2_corrected": False,
            "reflect_2_latency_ms": (time.time() - start) * 1000,
            "reflect_2_input_tokens": 0,
            "reflect_2_output_tokens": 0,
        }


async def reflect_draft(state: dict) -> dict:
    """Reflect on draft output, self-correct if needed."""
    params = state.get("tuning_params", {})
    temperature = params.get("temperature", 0.2)
    selected_tone = state.get("selected_tone", "professional")

    prompt = REFLECT_DRAFTER.format(
        previous_output=state.get("agent_3_output", ""),
        required_tone=selected_tone,
    )

    llm = _get_llm(temperature=temperature)

    start = time.time()
    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content=f"Original request: {state['input_text']}"),
        ])
        latency_ms = (time.time() - start) * 1000
        parsed = _parse_json(response.content)

        usage = response.usage_metadata or {}

        was_corrected = parsed.get("was_corrected", False)
        if was_corrected:
            state["draft"] = parsed

        return {
            **state,
            "draft": state.get("draft", parsed),
            "reflect_3_output": response.content,
            "reflect_3_corrected": was_corrected,
            "reflect_3_latency_ms": latency_ms,
            "reflect_3_input_tokens": usage.get("input_tokens", 0),
            "reflect_3_output_tokens": usage.get("output_tokens", 0),
        }
    except Exception as e:
        return {
            **state,
            "reflect_3_output": str(e),
            "reflect_3_corrected": False,
            "reflect_3_latency_ms": (time.time() - start) * 1000,
            "reflect_3_input_tokens": 0,
            "reflect_3_output_tokens": 0,
        }
