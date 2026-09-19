"""Unit tests for Feature Engine indicators and FeatureBuilder."""

from datetime import datetime, timedelta, timezone
import numpy as np
import pandas as pd
import pytest

from app.schemas.market import CanonicalCandle, OrderBookLevel
from app.services.feature_engine import (
    FeatureBuilder,
    calculate_atr,
    calculate_bollinger_bands,
    calculate_drawdown,
    calculate_log_returns,
    calculate_macd,
    calculate_orderbook_imbalance,
    calculate_returns,
    calculate_rolling_correlation,
    calculate_rolling_volatility,
    calculate_rsi,
)


def _generate_synthetic_candles(count: int = 60) -> list[CanonicalCandle]:
    """Generates synthetic candles for indicator verification."""
    now = datetime.now(timezone.utc)
    base_price = 100.0
    candles: list[CanonicalCandle] = []

    for i in range(count):
        t = now - timedelta(hours=count - i)
        price = base_price + np.sin(i / 5.0) * 10.0 + (i * 0.2)
        candles.append(
            CanonicalCandle(
                symbol="BTC",
                timeframe="1h",
                timestamp=t,
                open=price,
                high=price + 2.0,
                low=price - 2.0,
                close=price + 0.5,
                volume=1000.0 + (i * 10.0),
            )
        )
    return candles


def test_returns_and_log_returns() -> None:
    """Verify returns and log returns calculation."""
    prices = pd.Series([100.0, 105.0, 102.0, 110.0])
    ret = calculate_returns(prices)
    assert pytest.approx(ret.iloc[1], 1e-4) == 0.05
    assert pytest.approx(ret.iloc[2], 1e-4) == (102.0 - 105.0) / 105.0

    log_ret = calculate_log_returns(prices)
    assert pytest.approx(log_ret.iloc[1], 1e-4) == np.log(1.05)


def test_rsi_bounds() -> None:
    """Verify RSI remains bounded in [0, 100]."""
    # Monotonically rising prices
    bull_prices = pd.Series(np.linspace(100, 200, 50))
    rsi_bull = calculate_rsi(bull_prices, period=14)
    assert rsi_bull.iloc[-1] > 70.0
    assert (rsi_bull >= 0.0).all() and (rsi_bull <= 100.0).all()

    # Monotonically falling prices
    bear_prices = pd.Series(np.linspace(200, 100, 50))
    rsi_bear = calculate_rsi(bear_prices, period=14)
    assert rsi_bear.iloc[-1] < 30.0
    assert (rsi_bear >= 0.0).all() and (rsi_bear <= 100.0).all()


def test_macd_relationship() -> None:
    """Verify MACD line, signal line, and histogram identity."""
    prices = pd.Series(np.random.RandomState(42).randn(100).cumsum() + 100.0)
    macd, signal, hist = calculate_macd(prices)
    diff = (macd - signal) - hist
    assert pytest.approx(diff.abs().max(), 1e-6) == 0.0


def test_bollinger_bands_ordering() -> None:
    """Verify upper band >= middle band >= lower band."""
    prices = pd.Series(np.random.RandomState(42).randn(80).cumsum() + 50.0)
    middle, upper, lower, bandwidth = calculate_bollinger_bands(prices, window=20, num_std=2.0)
    assert (upper >= middle).all()
    assert (middle >= lower).all()
    assert (bandwidth >= 0.0).all()


def test_atr_non_negative() -> None:
    """Verify ATR is non-negative."""
    high = pd.Series([105.0, 107.0, 104.0, 110.0])
    low = pd.Series([98.0, 101.0, 99.0, 102.0])
    close = pd.Series([102.0, 103.0, 101.0, 108.0])
    atr = calculate_atr(high, low, close, period=2)
    assert (atr >= 0.0).all()


def test_drawdown_non_positive() -> None:
    """Verify drawdown is always non-positive and max drawdown is non-increasing."""
    prices = pd.Series([100.0, 110.0, 105.0, 90.0, 95.0, 120.0])
    dd, max_dd = calculate_drawdown(prices)
    assert (dd <= 0.0).all()
    assert (max_dd <= 0.0).all()
    # At 90.0 after peak 110.0: drawdown = (90-110)/110 = -0.1818
    assert pytest.approx(dd.iloc[3], 1e-3) == (90.0 - 110.0) / 110.0


def test_orderbook_imbalance() -> None:
    """Verify orderbook imbalance bounded in [-1.0, 1.0]."""
    # Bid-heavy
    bids = [OrderBookLevel(price=100.0, quantity=10.0)]
    asks = [OrderBookLevel(price=101.0, quantity=2.0)]
    obi = calculate_orderbook_imbalance(bids, asks)
    assert obi > 0.0
    assert obi <= 1.0

    # Ask-heavy
    bids = [OrderBookLevel(price=100.0, quantity=1.0)]
    asks = [OrderBookLevel(price=101.0, quantity=9.0)]
    obi = calculate_orderbook_imbalance(bids, asks)
    assert obi < 0.0
    assert obi >= -1.0


def test_rolling_correlation_bounds() -> None:
    """Verify rolling correlation values stay within [-1.0, 1.0]."""
    s1 = pd.Series(np.linspace(1, 100, 50))
    s2 = pd.Series(np.linspace(1, 100, 50)) + np.random.RandomState(42).randn(50)
    corr = calculate_rolling_correlation(s1, s2, window=20)
    assert (corr.dropna() >= -1.0).all()
    assert (corr.dropna() <= 1.0).all()


def test_feature_builder_inference_snapshot() -> None:
    """Verify FeatureBuilder produces valid point-in-time snapshot."""
    candles = _generate_synthetic_candles(count=50)
    builder = FeatureBuilder()
    snapshot = builder.build_inference_features("BTC", candles)

    assert snapshot.symbol == "BTC"
    assert snapshot.feature_version == "v1.0"
    assert "rsi_14" in snapshot.features
    assert "volatility_20" in snapshot.features
    assert "macd" in snapshot.features
    assert "bb_bandwidth" in snapshot.features
    assert snapshot.warmup_periods_used == 50


def test_zero_lookahead_bias() -> None:
    """Verify indicators computed at time T are identical whether calculated on full series or truncated up to T."""
    candles = _generate_synthetic_candles(count=60)
    builder = FeatureBuilder()

    # Full matrix
    full_df = builder.build_feature_matrix(candles)

    # Truncated series up to candle 40
    truncated_candles = candles[:40]
    truncated_df = builder.build_feature_matrix(truncated_candles)

    # Row 39 in truncated_df must equal row 39 in full_df
    for feature in ["rsi_14", "sma_20", "returns", "volatility_20", "macd", "drawdown"]:
        val_full = full_df[feature].iloc[39]
        val_truncated = truncated_df[feature].iloc[39]
        assert pytest.approx(val_full, 1e-5) == val_truncated, f"Lookahead bias detected in {feature}!"
