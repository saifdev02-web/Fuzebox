"""AgentTelemetry ORM model — matches V2 architecture doc Section 5."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Float, Integer, String, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class AgentTelemetry(Base):
    """Stores one row per agent call (V1 or V2)."""

    __tablename__ = "agent_telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    run_version: Mapped[str] = mapped_column(String(20), index=True)
    iteration: Mapped[int] = mapped_column(Integer, default=1)
    agent_id: Mapped[str] = mapped_column(String(50), index=True)
    agent_name: Mapped[str] = mapped_column(String(100))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    task_type: Mapped[str] = mapped_column(String(50))
    completion_status: Mapped[str] = mapped_column(String(20), default="success")
    escalation_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    auop_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_text: Mapped[str] = mapped_column(Text, default="")
    output_text: Mapped[str] = mapped_column(Text, default="")
    tuning_params: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    model_name: Mapped[str] = mapped_column(String(50), default="")
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSONB, nullable=True
    )

    def __repr__(self) -> str:
        return (
            f"<AgentTelemetry run={self.run_version} agent={self.agent_id} "
            f"status={self.completion_status}>"
        )
