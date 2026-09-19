"""Strategy registry, versioning, backtest runs, and on-chain verification models."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, Float, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, UUIDMixin


class Strategy(Base, UUIDMixin, TimestampMixin):
    """Canonical cryptographic trading strategy record."""
    __tablename__ = "strategies"

    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    asset: Mapped[str] = mapped_column(String(30), default="BTC/USDT", nullable=False, index=True)
    timeframe: Mapped[str] = mapped_column(String(20), default="1h", nullable=False)
    
    # Machine-readable rules dictionary (entry, exit, stop_loss, take_profit, etc.)
    canonical_rules: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    strategy_hash: Mapped[str] = mapped_column(String(66), nullable=False, index=True)
    ipfs_cid: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # On-Chain Registry Status
    is_onchain: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True, index=True)
    contract_address: Mapped[Optional[str]] = mapped_column(String(42), nullable=True)
    block_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    network: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    onchain_registered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Creator relationship / tracking
    creator_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("ix_strategies_hash_asset", "strategy_hash", "asset"),
    )


class StrategyPaperTrade(Base, UUIDMixin, TimestampMixin):
    """Simulated execution executed against real live market stream."""
    __tablename__ = "strategy_paper_trades"

    strategy_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    asset: Mapped[str] = mapped_column(String(30), nullable=False)
    signal: Mapped[str] = mapped_column(String(10), nullable=False) # BUY, SELL, HOLD
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    exit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    fees: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    slippage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    realized_pnl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    unrealized_pnl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", nullable=False) # OPEN, CLOSED


class StrategyVerification(Base, UUIDMixin, TimestampMixin):
    """Comprehensive AI and anomaly verification evaluation for a strategy."""
    __tablename__ = "strategy_verifications"

    strategy_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    backtest_run_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    
    # Status: VERIFIED, PARTIALLY_VERIFIED, UNDER_REVIEW, INSUFFICIENT_DATA, ANOMALY_DETECTED
    badge: Mapped[str] = mapped_column(String(30), default="INSUFFICIENT_DATA", nullable=False)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    score_breakdown: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Detailed AI Explanations
    performance_analysis: Mapped[str] = mapped_column(Text, nullable=False)
    risk_analysis: Mapped[str] = mapped_column(Text, nullable=False)
    overfitting_analysis: Mapped[str] = mapped_column(Text, nullable=False)

    # Traceable Anomaly & Failure Evaluations
    anomalies: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    failure_conditions: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    data_provenance: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
