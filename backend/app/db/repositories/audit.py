"""Audit logging repository for system traceability."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.audit import AuditLog
from app.db.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository[AuditLog]):
    """Repository recording security and analytical events."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AuditLog, session)

    async def log(
        self,
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """Appends an immutable audit entry."""
        audit_entry = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details or {},
            timestamp=datetime.now(timezone.utc),
        )
        self.session.add(audit_entry)
        await self.session.flush()
        await self.session.refresh(audit_entry)
        return audit_entry
