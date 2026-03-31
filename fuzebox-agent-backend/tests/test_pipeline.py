"""Unit tests for the LangGraph pipeline."""

from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app.agents.pipeline import run_pipeline
from tests.conftest import make_mock_llm_response


def _mock_llm_factory():
    """Create a mock LLM that returns different responses per call."""
    responses = [
        make_mock_llm_response(
            '{"classification": "billing", "confidence": 0.88, "reasoning": "Billing dispute"}'
        ),
        make_mock_llm_response(
            '{"priority": 4, "rationale": "Billing error with significant impact"}'
        ),
        make_mock_llm_response(
            '{"response": "We apologize for the billing discrepancy. Our team is reviewing your account.", '
            '"sentiment_flag": "negative", "tone_used": "empathetic"}'
        ),
    ]
    call_count = {"n": 0}

    async def _invoke(*args, **kwargs):
        idx = min(call_count["n"], len(responses) - 1)
        call_count["n"] += 1
        return responses[idx]

    mock = AsyncMock()
    mock.ainvoke = _invoke
    return mock


def _mock_llm_factory_v2():
    """Create a mock LLM for V2 (6 calls: 3 agents + 3 reflections)."""
    responses = [
        make_mock_llm_response('{"classification": "billing", "confidence": 0.88}'),
        make_mock_llm_response('{"classification": "billing", "confidence": 0.92, "was_corrected": false}'),
        make_mock_llm_response('{"priority": 4, "rationale": "High impact billing"}'),
        make_mock_llm_response('{"priority": 4, "rationale": "Confirmed", "was_corrected": false}'),
        make_mock_llm_response('{"response": "We apologize for the billing error.", "sentiment_flag": "negative"}'),
        make_mock_llm_response('{"response": "We sincerely apologize for the billing error.", "was_corrected": true}'),
    ]
    call_count = {"n": 0}

    async def _invoke(*args, **kwargs):
        idx = min(call_count["n"], len(responses) - 1)
        call_count["n"] += 1
        return responses[idx]

    mock = AsyncMock()
    mock.ainvoke = _invoke
    return mock


class TestV1Pipeline:
    @pytest.mark.asyncio
    async def test_v1_runs_three_agents(self):
        with patch("app.agents.nodes._get_llm") as mock_get:
            mock_get.return_value = _mock_llm_factory()

            final_state, collector = await run_pipeline(
                input_text="Our billing shows we were charged $4,500 this month but our plan is only $299/month.",
                run_version="v1",
            )

            assert final_state["agent_1_status"] == "success"
            assert final_state["agent_2_status"] == "success"
            assert final_state["agent_3_status"] == "success"
            assert len(collector.rows) == 3

    @pytest.mark.asyncio
    async def test_v1_telemetry_rows_correct(self):
        with patch("app.agents.nodes._get_llm") as mock_get:
            mock_get.return_value = _mock_llm_factory()

            _, collector = await run_pipeline(
                input_text="Test input",
                run_version="v1",
            )

            agents = [r.agent_id for r in collector.rows]
            assert "intake_classifier" in agents
            assert "triage_scorer" in agents
            assert "response_drafter" in agents
            for row in collector.rows:
                assert row.run_version == "v1"


class TestV2Pipeline:
    @pytest.mark.asyncio
    async def test_v2_runs_six_nodes(self):
        with patch("app.agents.nodes._get_llm") as mock_nodes, \
             patch("app.agents.react_nodes._get_llm") as mock_react:
            mock_nodes.return_value = _mock_llm_factory()
            mock_react.return_value = _mock_llm_factory_v2()

            final_state, collector = await run_pipeline(
                input_text="Our billing shows we were charged $4,500.",
                run_version="v2",
            )

            assert final_state["agent_1_status"] == "success"
            assert final_state["agent_2_status"] == "success"
            assert final_state["agent_3_status"] == "success"
            # V2 has 3 agent rows + 3 reflection rows = 6
            assert len(collector.rows) == 6

    @pytest.mark.asyncio
    async def test_v2_records_reflections(self):
        with patch("app.agents.nodes._get_llm") as mock_nodes, \
             patch("app.agents.react_nodes._get_llm") as mock_react:
            mock_nodes.return_value = _mock_llm_factory()
            mock_react.return_value = _mock_llm_factory_v2()

            _, collector = await run_pipeline(
                input_text="Billing issue test",
                run_version="v2",
            )

            reflect_rows = [r for r in collector.rows if "_reflect" in r.agent_id]
            assert len(reflect_rows) == 3
