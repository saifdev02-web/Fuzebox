"""Unit tests for individual agent nodes."""

import json
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app.agents.nodes import classify_node, triage_node, draft_node, _parse_json
from app.agents.config import V1_DEFAULTS, V2_PRESETS


# ── JSON parser tests ────────────────────────────────────────────────────

class TestParseJson:
    def test_valid_json(self):
        result = _parse_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_json_in_code_block(self):
        result = _parse_json('```json\n{"key": "value"}\n```')
        assert result == {"key": "value"}

    def test_json_with_surrounding_text(self):
        result = _parse_json('Here is the result: {"key": "value"} done.')
        assert result == {"key": "value"}

    def test_invalid_json_returns_raw(self):
        result = _parse_json("not json at all")
        assert "raw_output" in result
        assert result["parse_error"] is True


# ── Classify node tests ──────────────────────────────────────────────────

class TestClassifyNode:
    @pytest.mark.asyncio
    async def test_classify_success(self, mock_classify_response, sample_input_text):
        with patch("app.agents.nodes._get_llm") as mock_llm:
            mock_instance = AsyncMock()
            mock_instance.ainvoke.return_value = mock_classify_response
            mock_llm.return_value = mock_instance

            state = {
                "input_text": sample_input_text,
                "tuning_params": V1_DEFAULTS["intake_classifier"],
            }
            result = await classify_node(state)

            assert result["agent_1_status"] == "success"
            assert result["classification"]["classification"] == "access_auth"
            assert result["classification"]["confidence"] == 0.92
            assert result["agent_1_latency_ms"] > 0

    @pytest.mark.asyncio
    async def test_classify_failure_graceful(self, sample_input_text):
        with patch("app.agents.nodes._get_llm") as mock_llm:
            mock_instance = AsyncMock()
            mock_instance.ainvoke.side_effect = Exception("API timeout")
            mock_llm.return_value = mock_instance

            state = {
                "input_text": sample_input_text,
                "tuning_params": V1_DEFAULTS["intake_classifier"],
            }
            result = await classify_node(state)

            assert result["agent_1_status"] == "failure"
            assert result["classification"]["classification"] == "unclassified"
            assert "agent_1_error" in result


# ── Triage node tests ────────────────────────────────────────────────────

class TestTriageNode:
    @pytest.mark.asyncio
    async def test_triage_success(self, mock_triage_response, sample_input_text):
        with patch("app.agents.nodes._get_llm") as mock_llm:
            mock_instance = AsyncMock()
            mock_instance.ainvoke.return_value = mock_triage_response
            mock_llm.return_value = mock_instance

            state = {
                "input_text": sample_input_text,
                "classification": {"classification": "access_auth", "confidence": 0.9},
                "tuning_params": V1_DEFAULTS["triage_scorer"],
            }
            result = await triage_node(state)

            assert result["agent_2_status"] == "success"
            assert result["triage"]["priority"] == 4

    @pytest.mark.asyncio
    async def test_triage_with_prefetch(self, mock_triage_response, sample_input_text):
        with patch("app.agents.nodes._get_llm") as mock_llm:
            mock_instance = AsyncMock()
            mock_instance.ainvoke.return_value = mock_triage_response
            mock_llm.return_value = mock_instance

            state = {
                "input_text": sample_input_text,
                "classification": {"classification": "access_auth", "confidence": 0.9},
                "tuning_params": {**V2_PRESETS["triage_scorer"], "data_prefetch": True},
            }
            result = await triage_node(state)

            assert result["agent_2_status"] == "success"
            assert "customer_context" in result


# ── Draft node tests ─────────────────────────────────────────────────────

class TestDraftNode:
    @pytest.mark.asyncio
    async def test_draft_success(self, mock_draft_response, sample_input_text):
        with patch("app.agents.nodes._get_llm") as mock_llm:
            mock_instance = AsyncMock()
            mock_instance.ainvoke.return_value = mock_draft_response
            mock_llm.return_value = mock_instance

            state = {
                "input_text": sample_input_text,
                "classification": {"classification": "access_auth", "confidence": 0.9},
                "triage": {"priority": 4, "rationale": "Urgent"},
                "tuning_params": V1_DEFAULTS["response_drafter"],
            }
            result = await draft_node(state)

            assert result["agent_3_status"] == "success"
            assert "response" in result["draft"]

    @pytest.mark.asyncio
    async def test_draft_dynamic_tone(self, mock_draft_response, sample_input_text):
        with patch("app.agents.nodes._get_llm") as mock_llm:
            mock_instance = AsyncMock()
            mock_instance.ainvoke.return_value = mock_draft_response
            mock_llm.return_value = mock_instance

            state = {
                "input_text": sample_input_text,
                "classification": {"classification": "access_auth"},
                "triage": {"priority": 4, "sentiment": "negative"},
                "tuning_params": {**V2_PRESETS["response_drafter"], "tone_variant": "dynamic"},
            }
            result = await draft_node(state)

            assert result["agent_3_status"] == "success"
            assert result["selected_tone"] == "empathetic"
