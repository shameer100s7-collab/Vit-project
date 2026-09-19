"""Database models registry exporting all entity definitions for Alembic and application queries."""

from app.db.database import Base
from app.db.models.audit import AuditLog
from app.db.models.backtest import BacktestRun
from app.db.models.base import TimestampMixin, UUIDMixin
from app.db.models.market import MarketCandle, MarketSnapshot
from app.db.models.ml import ModelVersion
from app.db.models.portfolio import Portfolio, PortfolioAsset
from app.db.models.research import ResearchResult
from app.db.models.risk import RiskAnalysis
from app.db.models.signal import Signal
from app.db.models.user import User, UserRole

__all__ = [
    "Base",
    "TimestampMixin",
    "UUIDMixin",
    "User",
    "UserRole",
    "Portfolio",
    "PortfolioAsset",
    "MarketSnapshot",
    "MarketCandle",
    "Signal",
    "RiskAnalysis",
    "ResearchResult",
    "BacktestRun",
    "ModelVersion",
    "AuditLog",
]
