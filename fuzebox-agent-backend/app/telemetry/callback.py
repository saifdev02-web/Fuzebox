"""LangChain callback handler that writes telemetry rows to PostgreSQL."""

import time
import uuid
from datetime import datetime, timezone

from langchain_core.callbacks import BaseCallbackHandler
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.telemetry import AgentTelemetry

# Model pricing per 1K tokens (input, output)
MODEL_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.00015, 0.0006),
    "gpt-4o": (0.0025, 0.01),
    "gpt-3.5-turbo": (0.0005, 0.0015),
    "o3-mini": (0.0011, 0.0044),
    "o4-mini": (0.0011, 0.0044),
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate USD cost from token counts and model pricing."""
    pricing = MODEL_PRICING.get(model, (0.001, 0.003))
    return (input_tokens / 1000 * pricing[0]) + (output_tokens / 1000 * pricing[1])


class TelemetryCollector:
    """Collects telemetry data during a pipeline run and flushes to DB."""

    def __init__(
        self,
        run_id: uuid.UUID,
        run_version: str,
        iteration: int = 1,
        tuning_params: dict | None = None,
        model_name: str = "gpt-4o-mini",
    ):
        self.run_id = run_id
        self.run_version = run_version
        self.iteration = iteration
        self.tuning_params = tuning_params
        self.model_name = model_name
        self._rows: list[AgentTelemetry] = []

    def record(
        self,
        agent_id: str,
        agent_name: str,
        task_type: str,
        input_text: str,
        output_text: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: float,
        completion_status: str = "success",
        escalation_flag: bool = False,
        accuracy_score: float | None = None,
        metadata: dict | None = None,
    ) -> AgentTelemetry:
        """Record a single agent call as a telemetry row."""
        cost = calculate_cost(self.model_name, input_tokens, output_tokens)
        row = AgentTelemetry(
            timestamp=datetime.now(timezone.utc),
            run_id=self.run_id,
            run_version=self.run_version,
            iteration=self.iteration,
            agent_id=agent_id,
            agent_name=agent_name,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            task_type=task_type,
            completion_status=completion_status,
            escalation_flag=escalation_flag,
            latency_ms=latency_ms,
            accuracy_score=accuracy_score,
            input_text=input_text,
            output_text=output_text,
            tuning_params=self.tuning_params,
            cost_usd=round(cost, 6),
            model_name=self.model_name,
            metadata_=metadata,
        )
        self._rows.append(row)
        return row

    async def flush(self, session: AsyncSession) -> list[AgentTelemetry]:
        """Write all collected rows to the database."""
        for row in self._rows:
            session.add(row)
        await session.flush()
        return self._rows

    @property
    def rows(self) -> list[AgentTelemetry]:
        return list(self._rows)
