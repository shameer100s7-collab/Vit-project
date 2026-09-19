"""Risk assessment persistence models."""

from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import JSON, DateTime, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, UUIDMixin


class RiskAnalysis(Base, UUIDMixin, TimestampMixin):
    """Quantitative risk evaluation record for an asset or portfolio."""
    __tablename__ = "risk_analyses"

    target_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "PORTFOLIO" or "ASSET"
    target_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # symbol or portfolio UUID
    overall_risk: Mapped[float] = mapped_column(Float, nullable=False)
    volatility: Mapped[float] = mapped_column(Float, nullable=False)
    var_95: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cvar_95: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_drawdown: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sharpe_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sortino_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    beta: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    concentration_risk: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    metrics_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    __table_args__ = (
        Index("ix_risk_target_timestamp", "target_type", "target_id", "timestamp"),
    )
