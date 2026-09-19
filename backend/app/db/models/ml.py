"""Machine learning model registry and tracking models."""

from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import JSON, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, UUIDMixin


class ModelVersion(Base, UUIDMixin, TimestampMixin):
    """Machine learning model version metadata record."""
    __tablename__ = "model_versions"

    model_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., REGIME_DETECTION, SIGNAL_GENERATOR
    feature_version: Mapped[str] = mapped_column(String(50), nullable=False)
    dataset_version: Mapped[str] = mapped_column(String(50), nullable=False)
    metrics: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    parameters: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="CANDIDATE", nullable=False)  # CANDIDATE, PRODUCTION, RETIRED
    training_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_model_id_version", "model_id", "model_version"),
        Index("ix_model_status", "status"),
    )
