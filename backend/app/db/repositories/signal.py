"""Signal persistence repository."""

from typing import List, Optional
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.signal import Signal
from app.db.repositories.base import BaseRepository


class SignalRepository(BaseRepository[Signal]):
    """Repository managing quantitative Signal records."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Signal, session)

    async def get_latest_signals(
        self,
        symbol: Optional[str] = None,
        limit: int = 50,
    ) -> List[Signal]:
        """Retrieves most recent signals, optionally filtered by asset symbol."""
        query = select(Signal)
        if symbol:
            query = query.where(Signal.symbol == symbol.upper().strip())
        query = query.order_by(desc(Signal.timestamp)).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())
