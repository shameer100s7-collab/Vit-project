"""System security and analytical audit logging models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional
from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.db.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class AuditLog(Base, UUIDMixin, TimestampMixin):
    """Immutable audit trail of security and analytical actions."""
    __tablename__ = "audit_logs"

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_action_timestamp", "action", "timestamp"),
    )
