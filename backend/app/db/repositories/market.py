"""Market data persistence repository for snapshots and historical candles."""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.market import MarketCandle, MarketSnapshot
from app.db.repositories.base import BaseRepository


class MarketDataRepository:
    """Repository handling persistence of market snapshots and candles."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.snapshot_repo = BaseRepository[MarketSnapshot](MarketSnapshot, session)
        self.candle_repo = BaseRepository[MarketCandle](MarketCandle, session)

    async def get_latest_snapshot(self, symbol: str) -> Optional[MarketSnapshot]:
        """Finds the most recent market snapshot for a given symbol."""
        query = (
            select(MarketSnapshot)
            .where(MarketSnapshot.symbol == symbol.upper().strip())
            .order_by(desc(MarketSnapshot.timestamp))
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def get_candles(
        self,
        symbol: str,
        timeframe: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: int = 500,
    ) -> List[MarketCandle]:
        """Retrieves chronological candles for an asset and timeframe."""
        query = (
            select(MarketCandle)
            .where(
                MarketCandle.symbol == symbol.upper().strip(),
                MarketCandle.timeframe == timeframe,
            )
        )
        if start:
            query = query.where(MarketCandle.timestamp >= start)
        if end:
            query = query.where(MarketCandle.timestamp <= end)

        query = query.order_by(MarketCandle.timestamp.asc()).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def save_candle(
        self,
        symbol: str,
        timeframe: str,
        timestamp: datetime,
        open_: float,
        high: float,
        low: float,
        close: float,
        volume: float,
        trades_count: Optional[int] = None,
    ) -> MarketCandle:
        """Stores a validated OHLCV candle record."""
        candle = MarketCandle(
            symbol=symbol.upper().strip(),
            timeframe=timeframe,
            timestamp=timestamp,
            open=open_,
            high=high,
            low=low,
            close=close,
            volume=volume,
            trades_count=trades_count,
        )
        self.session.add(candle)
        await self.session.flush()
        await self.session.refresh(candle)
        return candle
