"""Unit tests for FastAPI endpoints."""

from unittest.mock import AsyncMock, patch, MagicMock
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.agents.config import V1_DEFAULTS, V2_PRESETS
from tests.conftest import make_mock_llm_response


# ── Health endpoint tests ────────────────────────────────────────────────

class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_check(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "fuzebox-agent-backend"

    @pytest.mark.asyncio
    async def test_usage_summary_empty(self, client):
        response = await client.get("/usage-summary")
        assert response.status_code == 200
        data = response.json()
        assert data["total_runs"] == 0
        assert data["total_cost_usd"] == 0.0


# ── Tuning parameter endpoint tests ─────────────────────────────────────

class TestTuningEndpoints:
    @pytest.mark.asyncio
    async def test_get_presets(self, client):
        response = await client.get("/tuning-params/presets")
        assert response.status_code == 200
        data = response.json()
        assert "v1_defaults" in data
        assert "v2_presets" in data
        assert "intake_classifier" in data["v1_defaults"]

    @pytest.mark.asyncio
    async def test_get_all_params_defaults(self, client):
        response = await client.get("/tuning-params/")
        assert response.status_code == 200
        data = response.json()
        assert data["source"] == "defaults"

    @pytest.mark.asyncio
    async def test_set_and_get_params(self, client):
        # Set
        payload = {
            "agent_id": "intake_classifier",
            "prompt_precision": 85,
            "confidence_threshold": 0.75,
            "fallback_depth": 3,
            "data_prefetch": False,
            "sentiment_weight": 0.0,
            "tone_variant": "professional",
        }
        response = await client.post(
            "/tuning-params/intake_classifier", json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == 1

        # Get
        response = await client.get("/tuning-params/intake_classifier")
        assert response.status_code == 200
        data = response.json()
        assert data["prompt_precision"] == 85
        assert data["source"] == "database"

    @pytest.mark.asyncio
    async def test_reset_params(self, client):
        # Set custom first
        payload = {
            "agent_id": "intake_classifier",
            "prompt_precision": 99,
            "confidence_threshold": 0.99,
            "fallback_depth": 5,
            "data_prefetch": True,
            "sentiment_weight": 1.0,
            "tone_variant": "custom",
        }
        await client.post("/tuning-params/intake_classifier", json=payload)

        # Reset
        response = await client.post("/tuning-params/reset/intake_classifier")
        assert response.status_code == 200
        data = response.json()
        assert data["params"]["prompt_precision"] == V2_PRESETS["intake_classifier"]["prompt_precision"]

    @pytest.mark.asyncio
    async def test_unknown_agent_404(self, client):
        response = await client.get("/tuning-params/nonexistent_agent")
        assert response.status_code == 404


# ── Telemetry endpoint tests ────────────────────────────────────────────

class TestTelemetryEndpoints:
    @pytest.mark.asyncio
    async def test_get_agent_telemetry_empty(self, client):
        response = await client.get("/telemetry/intake_classifier")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        assert data["rows"] == []

    @pytest.mark.asyncio
    async def test_get_all_telemetry_empty(self, client):
        response = await client.get("/telemetry/")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0

    @pytest.mark.asyncio
    async def test_comparison_no_data(self, client):
        response = await client.get("/telemetry/comparison/delta")
        assert response.status_code == 200
        data = response.json()
        assert "error" in data


# ── Run endpoint tests ──────────────────────────────────────────────────

class TestRunEndpoints:
    @pytest.mark.asyncio
    async def test_run_v1_validation(self, client):
        # Empty input should fail
        response = await client.post("/run/v1", json={"input_text": ""})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_run_v1_success(self, client):
        mock_responses = [
            make_mock_llm_response('{"classification": "access_auth", "confidence": 0.9}'),
            make_mock_llm_response('{"priority": 4, "rationale": "Urgent"}'),
            make_mock_llm_response('{"response": "We will help you.", "sentiment_flag": "neutral"}'),
        ]
        call_idx = {"n": 0}

        async def mock_invoke(*args, **kwargs):
            idx = min(call_idx["n"], len(mock_responses) - 1)
            call_idx["n"] += 1
            return mock_responses[idx]

        with patch("app.agents.nodes._get_llm") as mock_llm:
            mock_instance = AsyncMock()
            mock_instance.ainvoke = mock_invoke
            mock_llm.return_value = mock_instance

            response = await client.post(
                "/run/v1",
                json={"input_text": "I can't log in to my account."},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["run_version"] == "v1"
            assert "classification" in data
            assert "triage" in data
            assert "draft" in data

    @pytest.mark.asyncio
    async def test_run_v2_success(self, client):
        mock_responses = [
            make_mock_llm_response('{"classification": "billing", "confidence": 0.88}'),
            make_mock_llm_response('{"classification": "billing", "confidence": 0.92, "was_corrected": false}'),
            make_mock_llm_response('{"priority": 4, "rationale": "High"}'),
            make_mock_llm_response('{"priority": 4, "was_corrected": false}'),
            make_mock_llm_response('{"response": "We apologize.", "sentiment_flag": "negative"}'),
            make_mock_llm_response('{"response": "We sincerely apologize.", "was_corrected": true}'),
        ]
        call_idx = {"n": 0}

        async def mock_invoke(*args, **kwargs):
            idx = min(call_idx["n"], len(mock_responses) - 1)
            call_idx["n"] += 1
            return mock_responses[idx]

        with patch("app.agents.nodes._get_llm") as mock_nodes, \
             patch("app.agents.react_nodes._get_llm") as mock_react:
            mock_n = AsyncMock()
            mock_n.ainvoke = mock_invoke
            mock_nodes.return_value = mock_n

            mock_r = AsyncMock()
            mock_r.ainvoke = mock_invoke
            mock_react.return_value = mock_r

            response = await client.post(
                "/run/v2",
                json={"input_text": "Billing issue with overcharge."},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["run_version"] == "v2"
            assert data["telemetry_summary"]["agents_run"] == 6

    @pytest.mark.asyncio
    async def test_iteration_limit(self, client):
        response = await client.post(
            "/run/v1",
            json={"input_text": "Test", "iteration": 11},
        )
        assert response.status_code == 422
