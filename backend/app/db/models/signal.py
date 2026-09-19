"""Quantitative signal persistence models."""

from datetime import datetime
from typing import Any, Dict, List
from sqlalchemy import JSON, DateTime, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, UUIDMixin


class Signal(Base, UUIDMixin, TimestampMixin):
    """Quantitative trading and investment signal entity."""
    __tablename__ = "signals"

    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)  # LONG, SHORT, HOLD, NEUTRAL
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    strength: Mapped[float] = mapped_column(Float, nullable=False)
    time_horizon: Mapped[str] = mapped_column(String(20), default="SHORT_TERM", nullable=False)
    reasons: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    features_snapshot: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    __table_args__ = (
        Index("ix_signal_symbol_timestamp", "symbol", "timestamp"),
        Index("ix_signal_direction", "direction"),
    )
