"""Unit tests for repository data access layer."""

import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import UserRole
from app.db.repositories import (
    AuditLogRepository,
    MarketDataRepository,
    PortfolioRepository,
    RiskRepository,
    SignalRepository,
    UserRepository,
)


@pytest.mark.asyncio
async def test_user_repository_crud(db_session: AsyncSession) -> None:
    """Verify UserRepository CRUD operations."""
    repo = UserRepository(db_session)

    # 1. Create user
    user = await repo.create(
        email="test_quant@ghost.io",
        hashed_password="hashed_pw_abc",
        full_name="Alpha Researcher",
        role=UserRole.ANALYST,
    )
    assert user.id is not None
    assert user.email == "test_quant@ghost.io"

    # 2. Get by email
    found_by_email = await repo.get_by_email("TEST_QUANT@ghost.io")
    assert found_by_email is not None
    assert found_by_email.id == user.id

    # 3. Get by ID
    found_by_id = await repo.get_by_id(user.id)
    assert found_by_id is not None
    assert found_by_id.email == "test_quant@ghost.io"

    # 4. Count
    count = await repo.count()
    assert count >= 1


@pytest.mark.asyncio
async def test_portfolio_repository(db_session: AsyncSession) -> None:
    """Verify PortfolioRepository creates portfolios and manages associated holdings."""
    user_repo = UserRepository(db_session)
    portfolio_repo = PortfolioRepository(db_session)

    user = await user_repo.create(
        email="portfolio_owner@ghost.io",
        hashed_password="pw",
    )

    portfolio = await portfolio_repo.create(
        user_id=user.id,
        name="Crypto Macro Momentum",
        description="Multi-asset systematic momentum portfolio",
        initial_balance=100_000.0,
        current_value=105_500.0,
        currency="USD",
    )
    assert portfolio.id is not None

    # Add assets
    asset_btc = await portfolio_repo.add_asset(
        portfolio_id=portfolio.id,
        symbol="BTC",
        target_weight=0.60,
        current_weight=0.62,
        quantity=1.2,
        avg_entry_price=65_000.0,
    )
    assert asset_btc.id is not None
    assert asset_btc.symbol == "BTC"

    asset_eth = await portfolio_repo.add_asset(
        portfolio_id=portfolio.id,
        symbol="ETH",
        target_weight=0.40,
        current_weight=0.38,
        quantity=10.0,
        avg_entry_price=3_400.0,
    )
    assert asset_eth.id is not None

    # Retrieve with eager-loaded assets
    loaded_portfolio = await portfolio_repo.get_with_assets(portfolio.id)
    assert loaded_portfolio is not None
    assert len(loaded_portfolio.assets) == 2


@pytest.mark.asyncio
async def test_market_data_repository(db_session: AsyncSession) -> None:
    """Verify MarketDataRepository stores and queries chronological candles."""
    repo = MarketDataRepository(db_session)
    now = datetime.now(timezone.utc)

    candle = await repo.save_candle(
        symbol="SOL",
        timeframe="1h",
        timestamp=now,
        open_=140.0,
        high=145.5,
        low=139.2,
        close=144.8,
        volume=120_500.0,
        trades_count=4500,
    )
    assert candle.id is not None
    assert candle.symbol == "SOL"

    candles = await repo.get_candles(symbol="SOL", timeframe="1h")
    assert len(candles) == 1
    assert candles[0].close == 144.8


@pytest.mark.asyncio
async def test_signal_repository(db_session: AsyncSession) -> None:
    """Verify SignalRepository manages quantitative signals."""
    repo = SignalRepository(db_session)
    now = datetime.now(timezone.utc)

    signal = await repo.create(
        symbol="BTC",
        direction="LONG",
        confidence=0.85,
        strength=0.72,
        time_horizon="SHORT_TERM",
        reasons=["MACD bullish crossover", "Volume expansion > 2x 20d SMA"],
        features_snapshot={"rsi_14": 58.2, "volatility_annualized": 0.45},
        model_version="regime_classifier_v1.0",
        status="ACTIVE",
        timestamp=now,
    )
    assert signal.id is not None
    assert signal.direction == "LONG"

    latest = await repo.get_latest_signals(symbol="BTC", limit=10)
    assert len(latest) >= 1
    assert latest[0].symbol == "BTC"


@pytest.mark.asyncio
async def test_risk_repository(db_session: AsyncSession) -> None:
    """Verify RiskRepository persists and retrieves risk analysis records."""
    repo = RiskRepository(db_session)
    now = datetime.now(timezone.utc)

    risk = await repo.create(
        target_type="ASSET",
        target_id="ETH",
        overall_risk=0.55,
        volatility=0.68,
        var_95=-0.045,
        cvar_95=-0.065,
        max_drawdown=-0.22,
        sharpe_ratio=1.85,
        sortino_ratio=2.40,
        beta=1.15,
        concentration_risk=0.0,
        metrics_payload={"rolling_window_days": 90},
        timestamp=now,
    )
    assert risk.id is not None

    latest_risk = await repo.get_latest_analysis("ASSET", "ETH")
    assert latest_risk is not None
    assert latest_risk.volatility == 0.68


@pytest.mark.asyncio
async def test_audit_log_repository(db_session: AsyncSession) -> None:
    """Verify AuditLogRepository records security and audit events."""
    repo = AuditLogRepository(db_session)
    log = await repo.log(
        action="USER_REGISTRATION",
        entity_type="USER",
        entity_id="user-123",
        ip_address="127.0.0.1",
        details={"status": "success"},
    )
    assert log.id is not None
    assert log.action == "USER_REGISTRATION"
