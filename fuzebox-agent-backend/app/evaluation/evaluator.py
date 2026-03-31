"""Accuracy evaluator — fuzzy match for Agents 1+2, LLM evaluator for Agent 3.

Agent 1 (Classifier): Programmatic — classification in acceptable list + confidence
Agent 2 (Triage): Programmatic — priority within acceptable range
Agent 3 (Drafter): LLM evaluator with 5-criteria rubric
"""

import json

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from ..config import settings


# ── Programmatic scoring ─────────────────────────────────────────────────

def score_classification(output: dict, ground_truth: dict) -> float:
    """Score Agent 1 output against ground truth.

    Returns 0.0–1.0:
    - 0.5 for exact match to expected
    - 0.3 for match to acceptable list
    - 0.0 for no match
    - +0.5 bonus if confidence > 0.7
    """
    gt = ground_truth["classification"]
    classification = output.get("classification", "")

    # Handle array classifications
    if isinstance(classification, list):
        primary = classification[0] if classification else ""
    else:
        primary = classification

    primary = primary.lower().strip()
    expected = gt["expected"].lower().strip()
    acceptable = [a.lower().strip() for a in gt["acceptable"]]

    if primary == expected:
        base = 0.5
    elif primary in acceptable:
        base = 0.3
    else:
        base = 0.0

    confidence = output.get("confidence", 0.0)
    bonus = 0.5 if confidence > 0.7 else confidence * 0.5

    return min(1.0, round(base + bonus, 2))


def score_triage(output: dict, ground_truth: dict) -> float:
    """Score Agent 2 output against ground truth.

    Returns 0.0–1.0:
    - 1.0 for exact priority match
    - 0.7 for within acceptable range
    - 0.3 for off by 1 from range
    - 0.0 for off by 2+
    """
    gt = ground_truth["triage"]
    priority = output.get("priority", 3)
    expected = gt["expected_priority"]
    low, high = gt["acceptable_range"]

    if priority == expected:
        return 1.0
    elif low <= priority <= high:
        return 0.7
    elif abs(priority - expected) == 1:
        return 0.3
    else:
        return 0.0


# ── LLM-based evaluation for Agent 3 ────────────────────────────────────

EVALUATOR_SYSTEM_PROMPT = """You are an expert evaluator for customer support response quality.

Score the following draft response on 5 criteria, each from 0.0 to 1.0:

1. **Tone appropriateness**: Does the tone match the expected tone for the situation?
   (Expected tone: {expected_tone})
2. **Sentiment alignment**: Does the response correctly identify and respond to the customer's emotional state?
3. **Completeness**: Does the response address all points in the original request?
4. **Factual correctness**: Does the response avoid hallucinating details (dates, ticket numbers, prices) not present in the input?
5. **Brevity appropriateness**: Is the response length appropriate for the request complexity? (Max recommended: {max_words} words)

Also check:
- Response MUST contain these keywords/phrases: {must_contain}
- Response MUST NOT contain: {must_not_contain}

Return ONLY valid JSON:
{{
  "tone_score": <0.0-1.0>,
  "sentiment_score": <0.0-1.0>,
  "completeness_score": <0.0-1.0>,
  "factual_score": <0.0-1.0>,
  "brevity_score": <0.0-1.0>,
  "keyword_present": <true|false>,
  "forbidden_absent": <true|false>,
  "overall_score": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}}"""


async def score_draft_llm(
    original_request: str,
    draft_output: dict,
    ground_truth: dict,
) -> dict:
    """Score Agent 3 output using an LLM evaluator.

    Returns a dict with individual scores and an overall score.
    """
    gt = ground_truth["draft"]
    draft_text = draft_output.get("response", str(draft_output))

    system = EVALUATOR_SYSTEM_PROMPT.format(
        expected_tone=gt.get("expected_tone", "professional"),
        max_words=gt.get("max_words", 200),
        must_contain=", ".join(gt.get("must_contain", [])),
        must_not_contain=", ".join(gt.get("must_not_contain", [])) or "N/A",
    )

    user_msg = (
        f"Original customer request:\n{original_request}\n\n"
        f"Agent's draft response:\n{draft_text}"
    )

    try:
        llm = ChatOpenAI(
            model=settings.evaluator_model,
            api_key=settings.openai_api_key,
            temperature=0.0,
            timeout=30,
        )
        response = await llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=user_msg),
        ])

        # Parse response
        text = response.content.strip()
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

        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            return json.loads(text[start : end + 1])

        return {"overall_score": 0.5, "error": "Could not parse evaluator output"}

    except Exception as e:
        # Fallback to programmatic scoring
        return _fallback_draft_score(draft_text, gt)


def _fallback_draft_score(draft_text: str, gt: dict) -> dict:
    """Fallback programmatic scoring when LLM evaluator fails."""
    draft_lower = draft_text.lower()

    # Keyword check
    must_contain = gt.get("must_contain", [])
    keywords_found = sum(
        1 for kw in must_contain if kw.lower() in draft_lower
    )
    keyword_score = keywords_found / len(must_contain) if must_contain else 1.0

    # Forbidden check
    must_not_contain = gt.get("must_not_contain", [])
    forbidden_found = sum(
        1 for kw in must_not_contain if kw.lower() in draft_lower
    )
    forbidden_score = 1.0 if forbidden_found == 0 else 0.5

    # Length check
    word_count = len(draft_text.split())
    max_words = gt.get("max_words", 200)
    brevity_score = 1.0 if word_count <= max_words else max(0.3, 1 - (word_count - max_words) / max_words)

    overall = round((keyword_score + forbidden_score + brevity_score) / 3, 2)

    return {
        "tone_score": 0.5,
        "sentiment_score": 0.5,
        "completeness_score": keyword_score,
        "factual_score": forbidden_score,
        "brevity_score": round(brevity_score, 2),
        "keyword_present": keywords_found == len(must_contain),
        "forbidden_absent": forbidden_found == 0,
        "overall_score": overall,
        "reasoning": "Fallback programmatic scoring (LLM evaluator unavailable)",
    }


async def evaluate_run(
    request_id: str,
    input_text: str,
    pipeline_output: dict,
    ground_truth: dict,
) -> dict:
    """Evaluate a full pipeline run against ground truth.

    Returns per-agent accuracy scores and an overall score.
    """
    results = {}

    # Agent 1: Classification
    classification = pipeline_output.get("classification", {})
    results["agent_1_accuracy"] = score_classification(
        classification, ground_truth
    )

    # Agent 2: Triage
    triage = pipeline_output.get("triage", {})
    results["agent_2_accuracy"] = score_triage(triage, ground_truth)

    # Agent 3: Draft (LLM evaluation)
    draft = pipeline_output.get("draft", {})
    draft_eval = await score_draft_llm(input_text, draft, ground_truth)
    results["agent_3_accuracy"] = draft_eval.get("overall_score", 0.5)
    results["agent_3_detail"] = draft_eval

    # Overall accuracy
    results["overall_accuracy"] = round(
        (results["agent_1_accuracy"] + results["agent_2_accuracy"] + results["agent_3_accuracy"]) / 3,
        4,
    )

    return results
