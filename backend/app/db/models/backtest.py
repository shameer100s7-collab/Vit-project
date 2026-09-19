"""Backtest run and strategy execution persistence models."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import JSON, DateTime, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, UUIDMixin


class BacktestRun(Base, UUIDMixin, TimestampMixin):
    """Historical backtest execution and performance outcome record."""
    __tablename__ = "backtest_runs"

    strategy_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    parameters: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    initial_capital: Mapped[float] = mapped_column(Float, nullable=False)
    final_capital: Mapped[float] = mapped_column(Float, nullable=False)
    total_return: Mapped[float] = mapped_column(Float, nullable=False)
    annualized_return: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_drawdown: Mapped[float] = mapped_column(Float, nullable=False)
    sharpe: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sortino: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    win_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    profit_factor: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_trades: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    trades_log: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    equity_curve: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_backtest_strategy_created", "strategy_name", "created_at"),
    )
