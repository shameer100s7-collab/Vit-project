"""Risk analysis persistence repository."""

from typing import List, Optional
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.risk import RiskAnalysis
from app.db.repositories.base import BaseRepository


class RiskRepository(BaseRepository[RiskAnalysis]):
    """Repository managing RiskAnalysis records."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(RiskAnalysis, session)

    async def get_latest_analysis(
        self,
        target_type: str,
        target_id: str,
    ) -> Optional[RiskAnalysis]:
        """Fetches the latest risk analysis record for an asset or portfolio."""
        query = (
            select(RiskAnalysis)
            .where(
                RiskAnalysis.target_type == target_type.upper().strip(),
                RiskAnalysis.target_id == str(target_id).strip(),
            )
            .order_by(desc(RiskAnalysis.timestamp))
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def get_recent_analyses(
        self,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[RiskAnalysis]:
        """Fetches recent risk analysis records, optionally filtered by target."""
        query = select(RiskAnalysis)
        if target_type:
            query = query.where(RiskAnalysis.target_type == target_type.upper().strip())
        if target_id:
            query = query.where(RiskAnalysis.target_id == str(target_id).strip())
        query = query.order_by(desc(RiskAnalysis.timestamp)).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

