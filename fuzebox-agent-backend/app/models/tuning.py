"""TuningParameters ORM model — matches V2 architecture doc Section 5."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Float, Integer, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class TuningParameters(Base):
    """Stores per-agent tuning dial settings, linked to specific runs."""

    __tablename__ = "tuning_parameters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    agent_id: Mapped[str] = mapped_column(String(50), index=True)
    prompt_precision: Mapped[int] = mapped_column(Integer, default=40)
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.5)
    fallback_depth: Mapped[int] = mapped_column(Integer, default=1)
    data_prefetch: Mapped[bool] = mapped_column(Boolean, default=False)
    sentiment_weight: Mapped[float] = mapped_column(Float, default=0.0)
    tone_variant: Mapped[str] = mapped_column(String(30), default="professional")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def __repr__(self) -> str:
        return (
            f"<TuningParameters agent={self.agent_id} v={self.version} "
            f"active={self.is_active}>"
        )

    def to_dict(self) -> dict:
        """Serialize to a plain dict for embedding in telemetry rows."""
        return {
            "prompt_precision": self.prompt_precision,
            "confidence_threshold": self.confidence_threshold,
            "fallback_depth": self.fallback_depth,
            "data_prefetch": self.data_prefetch,
            "sentiment_weight": self.sentiment_weight,
            "tone_variant": self.tone_variant,
        }
