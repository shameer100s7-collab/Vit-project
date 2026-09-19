"""Unit tests for database models, metadata registration, and health checks."""

import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import check_db_health
from app.db.models import (
    AuditLog,
    BacktestRun,
    Base,
    MarketCandle,
    MarketSnapshot,
    ModelVersion,
    Portfolio,
    PortfolioAsset,
    ResearchResult,
    RiskAnalysis,
    Signal,
    User,
    UserRole,
)


def test_metadata_contains_all_core_models() -> None:
    """Verify all 11 required core tables are registered in Base.metadata."""
    expected_tables = {
        "users",
        "portfolios",
        "portfolio_assets",
        "market_snapshots",
        "market_candles",
        "signals",
        "risk_analyses",
        "research_results",
        "backtest_runs",
        "model_versions",
        "audit_logs",
    }
    registered_tables = set(Base.metadata.tables.keys())
    missing = expected_tables - registered_tables
    assert not missing, f"Missing registered tables: {missing}"


@pytest.mark.asyncio
async def test_database_health_check(db_session: AsyncSession) -> None:
    """Verify check_db_health executes query against active session."""
    is_healthy = await check_db_health(db_session)
    assert is_healthy is True


@pytest.mark.asyncio
async def test_user_model_instantiation(db_session: AsyncSession) -> None:
    """Verify User model attributes and defaults."""
    user = User(
        email="analyst@ghost.io",
        hashed_password="secure_hash_placeholder",
        full_name="Quant Analyst",
        role=UserRole.ANALYST,
    )
    db_session.add(user)
    await db_session.flush()

    assert isinstance(user.id, uuid.UUID)
    assert user.email == "analyst@ghost.io"
    assert user.role == UserRole.ANALYST
    assert user.is_active is True
    assert user.is_verified is False
    assert user.created_at is not None
    assert user.updated_at is not None
