"""Individual agent node functions for the LangGraph pipeline."""

import json
import time
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from ..config import settings
from .prompts import (
    CLASSIFIER_PROMPTS,
    TRIAGE_PROMPTS,
    DRAFT_PROMPTS,
    select_prompt,
    build_sentiment_suffix,
)
from .tools import fetch_customer_context


def _parse_json(text: str) -> dict:
    """Best-effort JSON extraction from LLM output."""
    text = text.strip()
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try extracting from markdown code block
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            cleaned = part.strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                continue
    # Try finding first { ... }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    return {"raw_output": text, "parse_error": True}


def _get_llm(temperature: float = 0.0, model: str | None = None) -> ChatOpenAI:
    """Create a ChatOpenAI instance with the given config."""
    return ChatOpenAI(
        model=model or settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=temperature,
        timeout=settings.agent_timeout_s,
    )


async def classify_node(state: dict) -> dict:
    """Agent 1: Intake Classifier — classifies the service request."""
    params = state.get("tuning_params", {})
    precision = params.get("prompt_precision", 40)
    temperature = params.get("temperature", 0.0)

    system_prompt = select_prompt(CLASSIFIER_PROMPTS, precision)
    llm = _get_llm(temperature=temperature)

    start = time.time()
    try:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=state["input_text"]),
        ])
        latency_ms = (time.time() - start) * 1000
        parsed = _parse_json(response.content)

        usage = response.usage_metadata or {}
        return {
            **state,
            "classification": parsed,
            "agent_1_output": response.content,
            "agent_1_latency_ms": latency_ms,
            "agent_1_input_tokens": usage.get("input_tokens", 0),
            "agent_1_output_tokens": usage.get("output_tokens", 0),
            "agent_1_status": "success",
        }
    except Exception as e:
        latency_ms = (time.time() - start) * 1000
        return {
            **state,
            "classification": {"classification": "unclassified", "confidence": 0.0},
            "agent_1_output": str(e),
            "agent_1_latency_ms": latency_ms,
            "agent_1_input_tokens": 0,
            "agent_1_output_tokens": 0,
            "agent_1_status": "failure",
            "agent_1_error": str(e),
        }


async def triage_node(state: dict) -> dict:
    """Agent 2: Triage Scorer — assigns priority score."""
    params = state.get("tuning_params", {})
    precision = params.get("prompt_precision", 35)
    temperature = params.get("temperature", 0.0)
    sentiment_weight = params.get("sentiment_weight", 0.0)
    data_prefetch = params.get("data_prefetch", False)

    system_prompt = select_prompt(TRIAGE_PROMPTS, precision)
    system_prompt += build_sentiment_suffix(sentiment_weight)

    # Build context message
    context_parts = [
        f"Original request: {state['input_text']}",
        f"Classification: {json.dumps(state.get('classification', {}))}",
    ]

    if data_prefetch:
        customer_ctx = fetch_customer_context(state["input_text"])
        context_parts.append(f"Customer context: {json.dumps(customer_ctx)}")
        state["customer_context"] = customer_ctx

    llm = _get_llm(temperature=temperature)

    start = time.time()
    try:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content="\n\n".join(context_parts)),
        ])
        latency_ms = (time.time() - start) * 1000
        parsed = _parse_json(response.content)

        usage = response.usage_metadata or {}
        return {
            **state,
            "triage": parsed,
            "agent_2_output": response.content,
            "agent_2_latency_ms": latency_ms,
            "agent_2_input_tokens": usage.get("input_tokens", 0),
            "agent_2_output_tokens": usage.get("output_tokens", 0),
            "agent_2_status": "success",
        }
    except Exception as e:
        latency_ms = (time.time() - start) * 1000
        return {
            **state,
            "triage": {"priority": 3, "rationale": "Default due to error"},
            "agent_2_output": str(e),
            "agent_2_latency_ms": latency_ms,
            "agent_2_input_tokens": 0,
            "agent_2_output_tokens": 0,
            "agent_2_status": "failure",
            "agent_2_error": str(e),
        }


async def draft_node(state: dict) -> dict:
    """Agent 3: Response Drafter — drafts customer response."""
    params = state.get("tuning_params", {})
    precision = params.get("prompt_precision", 30)
    temperature = params.get("temperature", 0.0)
    sentiment_weight = params.get("sentiment_weight", 0.0)
    tone_variant = params.get("tone_variant", "professional")

    system_prompt = select_prompt(DRAFT_PROMPTS, precision)
    system_prompt += build_sentiment_suffix(sentiment_weight)

    # Auto-select tone for "dynamic" mode
    if tone_variant == "dynamic":
        sentiment = state.get("triage", {}).get("sentiment", "neutral")
        if sentiment == "negative":
            tone_variant = "empathetic"
        elif sentiment == "positive":
            tone_variant = "concise"
        else:
            tone_variant = "professional"
        system_prompt += f"\n\nUse a {tone_variant} tone for this response."

    context_parts = [
        f"Original request: {state['input_text']}",
        f"Classification: {json.dumps(state.get('classification', {}))}",
        f"Priority: {json.dumps(state.get('triage', {}))}",
    ]

    llm = _get_llm(temperature=temperature)

    start = time.time()
    try:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content="\n\n".join(context_parts)),
        ])
        latency_ms = (time.time() - start) * 1000
        parsed = _parse_json(response.content)

        usage = response.usage_metadata or {}
        return {
            **state,
            "draft": parsed,
            "agent_3_output": response.content,
            "agent_3_latency_ms": latency_ms,
            "agent_3_input_tokens": usage.get("input_tokens", 0),
            "agent_3_output_tokens": usage.get("output_tokens", 0),
            "agent_3_status": "success",
            "selected_tone": tone_variant,
        }
    except Exception as e:
        latency_ms = (time.time() - start) * 1000
        return {
            **state,
            "draft": {"response": "We are looking into your request.", "sentiment_flag": "neutral"},
            "agent_3_output": str(e),
            "agent_3_latency_ms": latency_ms,
            "agent_3_input_tokens": 0,
            "agent_3_output_tokens": 0,
            "agent_3_status": "failure",
            "agent_3_error": str(e),
        }
