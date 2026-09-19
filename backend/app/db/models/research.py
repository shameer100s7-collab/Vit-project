"""Historical research and quantitative study persistence models."""

from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import JSON, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, UUIDMixin


class ResearchResult(Base, UUIDMixin, TimestampMixin):
    """Historical study, regime analysis, or correlation research artifact."""
    __tablename__ = "research_results"

    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    study_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # e.g., REGIME_STUDY, CORRELATION
    parameters: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    findings: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    methodology: Mapped[str] = mapped_column(Text, nullable=False)
    assumptions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    data_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    __table_args__ = (
        Index("ix_research_symbol_type", "symbol", "study_type"),
    )
