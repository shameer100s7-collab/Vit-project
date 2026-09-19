"""Unit tests for Quantitative Risk Engine components and mathematical algorithms."""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.risk import RiskLevel
from app.services.risk_engine.var_calculator import VaRCalculator
from app.services.risk_engine.drawdown_calculator import DrawdownCalculator
from app.services.risk_engine.metrics_calculator import RiskMetricsCalculator
from app.services.risk_engine.position_sizing import PositionSizingEngine
from app.services.risk_engine.portfolio_risk import PortfolioRiskCalculator
from app.services.risk_engine.service import RiskEngineService
from app.services.market_data import MarketDataService, MockMarketDataProvider


@pytest.fixture
def sample_returns() -> pd.Series:
    """Generates synthetic stationary daily return series for deterministic testing."""
    np.random.seed(42)
    # 100 days with mean 0.001 (0.1% daily) and daily std 0.02 (2%)
    return pd.Series(np.random.normal(loc=0.001, scale=0.02, size=100))


@pytest.fixture
def sample_prices() -> pd.Series:
    """Generates deterministic synthetic price series with a clear peak and drawdown."""
    # 100 -> 120 -> 90 -> 110
    prices = [100.0, 105.0, 115.0, 120.0, 110.0, 96.0, 90.0, 95.0, 105.0, 110.0]
    return pd.Series(prices)


def test_var_calculator_parametric_and_historical(sample_returns: pd.Series) -> None:
    """Tests parametric and historical VaR and CVaR calculations and ordering."""
    var_metrics = VaRCalculator.evaluate_var_metrics(sample_returns)

    # VaR 95% should be greater than 0
    assert var_metrics.var_95_daily > 0.0
    # VaR 99% must be strictly greater than VaR 95%
    assert var_metrics.var_99_daily >= var_metrics.var_95_daily

    # CVaR (Expected Shortfall) must be strictly >= VaR at the same confidence
    assert var_metrics.cvar_95_daily >= var_metrics.var_95_daily
    assert var_metrics.cvar_99_daily >= var_metrics.var_99_daily

    # Check that individual parametric and historical calculations returned non-zero
    assert var_metrics.parametric_var_95 > 0.0
    assert var_metrics.historical_var_95 > 0.0
    assert var_metrics.parametric_cvar_95 >= var_metrics.parametric_var_95
    assert var_metrics.historical_cvar_95 >= var_metrics.historical_var_95


def test_var_calculator_edge_cases() -> None:
    """Tests VaR handling of empty, single-value, and zero-volatility returns."""
    # Empty
    empty_res = VaRCalculator.evaluate_var_metrics(pd.Series([], dtype=float))
    assert empty_res.var_95_daily == 0.0
    assert empty_res.method == "INSUFFICIENT_DATA"

    # Single value
    single_res = VaRCalculator.evaluate_var_metrics(pd.Series([0.05]))
    assert single_res.var_95_daily == 0.0

    # Constant non-zero returns (zero standard deviation)
    constant_res = VaRCalculator.evaluate_var_metrics(pd.Series([0.01, 0.01, 0.01, 0.01]))
    assert constant_res.var_95_daily == 0.0  # Since gain, no loss


def test_drawdown_calculator(sample_prices: pd.Series) -> None:
    """Tests peak-to-trough drawdown calculation, peak price, trough, and duration."""
    metrics = DrawdownCalculator.calculate_drawdown_metrics(sample_prices)

    # Peak price was 120.0, lowest trough after peak was 90.0
    # Expected max drawdown: (90 - 120) / 120 = -30 / 120 = -0.25 (-25%)
    assert metrics.peak_price == 120.0
    assert metrics.trough_price == 90.0
    assert metrics.max_drawdown == pytest.approx(-0.25, abs=1e-3)

    # Current price is 110.0, current drawdown: (110 - 120) / 120 = -8.33%
    assert metrics.current_drawdown == pytest.approx(-0.0833, abs=1e-3)

    # Most recent peak was at index 3 (price 120), current index is 9 -> duration = 9 - 3 = 6
    assert metrics.drawdown_duration_periods == 6


def test_drawdown_monotonic_prices() -> None:
    """Tests drawdown on monotonic increasing and decreasing price trajectories."""
    # Monotonic increasing: no drawdown
    increasing = pd.Series([10.0, 20.0, 30.0, 40.0, 50.0])
    inc_metrics = DrawdownCalculator.calculate_drawdown_metrics(increasing)
    assert inc_metrics.max_drawdown == 0.0
    assert inc_metrics.current_drawdown == 0.0
    assert inc_metrics.drawdown_duration_periods == 0

    # Monotonic decreasing: max drawdown is from start to end
    decreasing = pd.Series([100.0, 80.0, 60.0, 50.0])
    dec_metrics = DrawdownCalculator.calculate_drawdown_metrics(decreasing)
    assert dec_metrics.max_drawdown == pytest.approx(-0.50, abs=1e-3)
    assert dec_metrics.current_drawdown == pytest.approx(-0.50, abs=1e-3)


def test_risk_metrics_calculator(sample_returns: pd.Series) -> None:
    """Tests annualized volatility, downside deviation, Sharpe, Sortino, and Calmar ratios."""
    metrics = RiskMetricsCalculator.calculate_risk_adjusted_metrics(
        returns=sample_returns,
        max_drawdown=-0.20,
        risk_free_rate=0.04,
        periods_per_year=365,
    )

    assert metrics.annualized_volatility > 0.0
    assert metrics.downside_deviation > 0.0
    assert isinstance(metrics.sharpe_ratio, float)
    assert isinstance(metrics.sortino_ratio, float)
    assert isinstance(metrics.calmar_ratio, float)
    assert metrics.risk_free_rate == 0.04


def test_beta_and_correlation() -> None:
    """Tests market Beta and benchmark correlation calculations."""
    np.random.seed(123)
    bm_returns = pd.Series(np.random.normal(0.001, 0.02, 100))

    # Test 1: Identical series must have Beta = 1.0 and Correlation = 1.0
    sens_same = RiskMetricsCalculator.calculate_beta_and_correlation(bm_returns, bm_returns)
    assert sens_same.beta == pytest.approx(1.0, abs=1e-2)
    assert sens_same.correlation_with_benchmark == pytest.approx(1.0, abs=1e-2)

    # Test 2: Double leveraged series (2x benchmark)
    leveraged_returns = bm_returns * 2.0
    sens_lev = RiskMetricsCalculator.calculate_beta_and_correlation(leveraged_returns, bm_returns)
    assert sens_lev.beta == pytest.approx(2.0, abs=1e-2)
    assert sens_lev.correlation_with_benchmark == pytest.approx(1.0, abs=1e-2)


def test_position_sizing_engine() -> None:
    """Tests volatility-targeted position sizing recommendations and bounds."""
    # Low volatility asset -> higher position cap
    low_vol_sizing = PositionSizingEngine.calculate_position_sizing(
        volatility_annualized=0.20,
        var_95_daily=0.015,
        max_drawdown=-0.10,
        target_volatility=0.20,
        risk_budget_pct=0.02,
    )
    assert low_vol_sizing.max_position_pct >= 0.20
    assert low_vol_sizing.recommended_leverage >= 1.0

    # High volatility asset with severe drawdown -> heavily restricted allocation
    high_vol_sizing = PositionSizingEngine.calculate_position_sizing(
        volatility_annualized=0.95,
        var_95_daily=0.08,
        max_drawdown=-0.65,
        target_volatility=0.20,
        risk_budget_pct=0.02,
    )
    assert high_vol_sizing.max_position_pct < low_vol_sizing.max_position_pct
    assert high_vol_sizing.recommended_leverage == 1.0
    assert high_vol_sizing.max_position_pct >= 0.02  # Enforces lower bound


def test_portfolio_risk_calculator_concentration_and_variance() -> None:
    """Tests Herfindahl-Hirschman Index and multi-asset portfolio variance aggregation."""
    # 1. Single asset portfolio -> HHI = 1.0, Norm HHI = 0.0
    single_asset = {"BTC/USDT": 1.0}
    conc_single = PortfolioRiskCalculator.calculate_concentration(single_asset)
    assert conc_single.hhi == 1.0
    assert conc_single.normalized_hhi == 0.0
    assert conc_single.effective_assets == 1.0

    # 2. Equal weight 4 assets -> HHI = 4 * 0.25^2 = 0.25, Norm HHI = 0.0, effective = 4.0
    equal_4 = {"BTC/USDT": 25.0, "ETH/USDT": 25.0, "SOL/USDT": 25.0, "AVAX/USDT": 25.0}
    conc_equal = PortfolioRiskCalculator.calculate_concentration(equal_4)
    assert conc_equal.hhi == pytest.approx(0.25, abs=1e-3)
    assert conc_equal.normalized_hhi == pytest.approx(0.0, abs=1e-3)
    assert conc_equal.effective_assets == pytest.approx(4.0, abs=1e-1)

    # 3. Concentrated 2 assets (90% / 10%)
    skewed = {"BTC/USDT": 0.90, "ETH/USDT": 0.10}
    conc_skewed = PortfolioRiskCalculator.calculate_concentration(skewed)
    # HHI = 0.81 + 0.01 = 0.82
    assert conc_skewed.hhi == pytest.approx(0.82, abs=1e-2)
    assert conc_skewed.normalized_hhi > 0.50

    # 4. Multi-asset return synthesis
    np.random.seed(42)
    asset_returns = {
        "BTC/USDT": pd.Series(np.random.normal(0.001, 0.02, 50)),
        "ETH/USDT": pd.Series(np.random.normal(0.001, 0.03, 50)),
    }
    p_returns, p_vol, mrc = PortfolioRiskCalculator.compute_portfolio_returns_and_risk(
        asset_returns=asset_returns,
        weights={"BTC/USDT": 0.6, "ETH/USDT": 0.4},
    )
    assert len(p_returns) == 50
    assert p_vol > 0.0
    assert "BTC/USDT" in mrc and "ETH/USDT" in mrc
    # Marginal risk contributions sum to 1.0
    assert sum(mrc.values()) == pytest.approx(1.0, abs=1e-2)


@pytest.mark.asyncio
async def test_risk_engine_service_end_to_end(db_session) -> None:
    """Tests RiskEngineService end-to-end evaluation, database persistence, and score bounds."""
    mock_provider = MockMarketDataProvider()
    market_data_service = MarketDataService(provider=mock_provider)
    service = RiskEngineService(market_data_service=market_data_service)

    # Evaluate asset risk for BTC/USDT
    result = await service.evaluate_asset_risk(
        symbol="BTC/USDT",
        timeframe="1h",
        lookback_candles=100,
        session=db_session,
        persist=True,
    )

    assert result.symbol == "BTC/USDT"
    assert 0.05 <= result.overall_risk_score <= 0.95
    assert result.risk_level in [RiskLevel.LOW, RiskLevel.MODERATE, RiskLevel.HIGH, RiskLevel.CRITICAL]
    assert result.var_metrics.var_95_daily >= 0.0
    assert result.drawdown_metrics.max_drawdown <= 0.0
    assert result.risk_adjusted_metrics.annualized_volatility >= 0.0
    assert result.sensitivity_metrics is not None
    assert result.sensitivity_metrics.beta == 1.0  # BTC vs BTC benchmark
    assert result.position_sizing.max_position_pct > 0.0
    assert result.analysis_id is not None  # Persisted to DB

    # Verify retrieval from history
    history = await service.get_historical_risk(
        target_type="ASSET",
        target_id="BTC/USDT",
        limit=10,
        session=db_session,
    )
    assert len(history) >= 1
    latest_hist = history[0]
    assert latest_hist.target_type == "ASSET"
    assert latest_hist.target_id == "BTC/USDT"
    assert latest_hist.overall_risk == result.overall_risk_score


@pytest.mark.asyncio
async def test_risk_engine_service_portfolio_evaluation(db_session) -> None:
    """Tests RiskEngineService portfolio evaluation, covariance, and HHI bounds."""
    from app.schemas.risk import PortfolioRiskRequest, PortfolioAssetInput

    mock_provider = MockMarketDataProvider()
    market_data_service = MarketDataService(provider=mock_provider)
    service = RiskEngineService(market_data_service=market_data_service)

    req = PortfolioRiskRequest(
        assets=[
            PortfolioAssetInput(symbol="BTC/USDT", weight=0.6),
            PortfolioAssetInput(symbol="ETH/USDT", weight=0.4),
        ],
        timeframe="1h",
        lookback_candles=100,
        portfolio_name="AlphaCore",
    )

    port_res = await service.evaluate_portfolio_risk(
        request=req,
        session=db_session,
        persist=True,
    )

    assert port_res.portfolio_name == "AlphaCore"
    assert 0.05 <= port_res.overall_risk_score <= 0.95
    assert port_res.portfolio_volatility_annualized > 0.0
    assert port_res.portfolio_var_95_daily >= 0.0
    assert port_res.concentration.hhi > 0.0
    assert "BTC/USDT" in port_res.component_risks
    assert "ETH/USDT" in port_res.component_risks
    assert port_res.analysis_id is not None

