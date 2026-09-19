"""Market snapshot and OHLCV candle persistence models."""

from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, UUIDMixin


class MarketSnapshot(Base, UUIDMixin, TimestampMixin):
    """Point-in-time ticker and market state snapshot."""
    __tablename__ = "market_snapshots"

    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    volume_24h: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    high_24h: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    low_24h: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    change_24h: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    market_cap: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    liquidity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    __table_args__ = (
        Index("ix_snapshot_symbol_timestamp", "symbol", "timestamp"),
    )


class MarketCandle(Base, UUIDMixin, TimestampMixin):
    """Historical and aggregated OHLCV candle data."""
    __tablename__ = "market_candles"

    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # e.g., "1m", "5m", "1h", "1d"
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    open: Mapped[float] = mapped_column(Float, nullable=False)
    high: Mapped[float] = mapped_column(Float, nullable=False)
    low: Mapped[float] = mapped_column(Float, nullable=False)
    close: Mapped[float] = mapped_column(Float, nullable=False)
    volume: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    trades_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("symbol", "timeframe", "timestamp", name="uq_candle_symbol_timeframe_timestamp"),
        Index("ix_candle_symbol_tf_ts", "symbol", "timeframe", "timestamp"),
    )
