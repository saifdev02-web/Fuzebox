"""Unit tests for telemetry callback and metrics calculations."""

import uuid

import pytest
import pytest_asyncio

from app.telemetry.callback import TelemetryCollector, calculate_cost
from app.telemetry.metrics import (
    completion_rate,
    accuracy,
    escalation_rate,
    avg_task_time,
    auop_score,
    human_to_agent_ratio,
    rop,
    compute_delta,
)


# ── Cost calculation tests ───────────────────────────────────────────────

class TestCostCalculation:
    def test_gpt54_mini_cost(self):
        cost = calculate_cost("gpt-5.4-mini", 1000, 500)
        # 1000/1000 * 0.0004 + 500/1000 * 0.0016 = 0.0004 + 0.0008 = 0.0012
        assert abs(cost - 0.0012) < 0.0001

    def test_gpt41_nano_cost(self):
        cost = calculate_cost("gpt-4.1-nano", 1000, 500)
        # 1000/1000 * 0.0001 + 500/1000 * 0.0004 = 0.0001 + 0.0002 = 0.0003
        assert abs(cost - 0.0003) < 0.0001

    def test_unknown_model_uses_default(self):
        cost = calculate_cost("unknown-model", 1000, 1000)
        assert cost > 0


# ── Telemetry collector tests ────────────────────────────────────────────

class TestTelemetryCollector:
    def test_record_creates_row(self):
        collector = TelemetryCollector(
            run_id=uuid.uuid4(), run_version="v1"
        )
        row = collector.record(
            agent_id="intake_classifier",
            agent_name="Intake Classifier",
            task_type="classification",
            input_text="test input",
            output_text="test output",
            input_tokens=50,
            output_tokens=30,
            latency_ms=150.0,
        )
        assert row.agent_id == "intake_classifier"
        assert row.run_version == "v1"
        assert row.cost_usd > 0
        assert len(collector.rows) == 1

    def test_multiple_records(self):
        collector = TelemetryCollector(
            run_id=uuid.uuid4(), run_version="v2", iteration=2
        )
        for i in range(3):
            collector.record(
                agent_id=f"agent_{i}",
                agent_name=f"Agent {i}",
                task_type="test",
                input_text="in",
                output_text="out",
                input_tokens=10,
                output_tokens=5,
                latency_ms=100.0,
            )
        assert len(collector.rows) == 3
        for row in collector.rows:
            assert row.iteration == 2

    @pytest_asyncio.fixture
    async def test_flush(self, db_session):
        collector = TelemetryCollector(
            run_id=uuid.uuid4(), run_version="v1"
        )
        collector.record(
            agent_id="test_agent",
            agent_name="Test",
            task_type="test",
            input_text="in",
            output_text="out",
            input_tokens=10,
            output_tokens=5,
            latency_ms=100.0,
        )
        rows = await collector.flush(db_session)
        assert len(rows) == 1


# ── Metrics tests ────────────────────────────────────────────────────────

class TestMetrics:
    @pytest.fixture
    def sample_rows(self):
        return [
            {
                "completion_status": "success",
                "accuracy_score": 0.9,
                "escalation_flag": False,
                "latency_ms": 200,
                "cost_usd": 0.001,
            },
            {
                "completion_status": "success",
                "accuracy_score": 0.8,
                "escalation_flag": False,
                "latency_ms": 300,
                "cost_usd": 0.002,
            },
            {
                "completion_status": "failure",
                "accuracy_score": 0.5,
                "escalation_flag": True,
                "latency_ms": 500,
                "cost_usd": 0.001,
            },
        ]

    def test_completion_rate(self, sample_rows):
        assert completion_rate(sample_rows) == pytest.approx(0.6667, abs=0.01)

    def test_accuracy(self, sample_rows):
        assert accuracy(sample_rows) == pytest.approx(0.7333, abs=0.01)

    def test_escalation_rate(self, sample_rows):
        assert escalation_rate(sample_rows) == pytest.approx(0.3333, abs=0.01)

    def test_avg_task_time(self, sample_rows):
        # (200+300+500) / 3 / 1000 = 0.333 seconds
        assert avg_task_time(sample_rows) == pytest.approx(0.33, abs=0.01)

    def test_auop_score_returns_float(self, sample_rows):
        score = auop_score(sample_rows)
        assert 0.0 <= score <= 1.0

    def test_empty_rows(self):
        assert completion_rate([]) == 0.0
        assert accuracy([]) == 0.0
        assert escalation_rate([]) == 0.0
        assert avg_task_time([]) == 0.0

    def test_human_to_agent_ratio(self, sample_rows):
        ratio = human_to_agent_ratio(sample_rows)
        assert "total_tasks" in ratio
        assert ratio["total_tasks"] == 3
        assert "ratio" in ratio

    def test_rop(self, sample_rows):
        result = rop(sample_rows)
        assert "agent_cost" in result
        assert "savings" in result
        assert "rop_pct" in result

    def test_compute_delta(self, sample_rows):
        v1_rows = sample_rows
        v2_rows = [
            {
                "completion_status": "success",
                "accuracy_score": 0.95,
                "escalation_flag": False,
                "latency_ms": 150,
                "cost_usd": 0.002,
            },
            {
                "completion_status": "success",
                "accuracy_score": 0.92,
                "escalation_flag": False,
                "latency_ms": 200,
                "cost_usd": 0.002,
            },
            {
                "completion_status": "success",
                "accuracy_score": 0.88,
                "escalation_flag": False,
                "latency_ms": 250,
                "cost_usd": 0.002,
            },
        ]
        delta = compute_delta(v1_rows, v2_rows)
        assert delta["completion_rate"]["improved"] is True
        assert delta["accuracy"]["improved"] is True
        assert delta["escalation_rate"]["improved"] is True
