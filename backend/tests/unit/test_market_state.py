"""Unit tests for Market State Intelligence Engine and regime classifiers."""

from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import (
    EvidenceItem,
    MarketState,
    MarketStateResult,
    MarketStateScores,
)
from app.services.market_state.base import MarketStateClassifier
from app.services.market_state.evidence import ConflictAnalyzer
from app.services.market_state.rule_based import (
    MarketStateThresholds,
    RuleBasedMarketStateClassifier,
)
from app.services.market_state.service import MarketStateService


def _create_snapshot(features_dict: dict, symbol: str = "BTC") -> FeatureSnapshot:
    """Helper creating a FeatureSnapshot with baseline default indicator values."""
    base_features = {
        "close": 50000.0,
        "returns": 0.0,
        "log_returns": 0.0,
        "volatility_20": 0.02,
        "atr_14": 500.0,
        "sma_20": 50000.0,
        "sma_50": 50000.0,
        "ema_12": 50000.0,
        "ema_26": 50000.0,
        "trend_strength": 0.0,
        "rsi_14": 50.0,
        "macd": 0.0,
        "macd_signal": 0.0,
        "macd_hist": 0.0,
        "momentum_10": 0.0,
        "bb_bandwidth": 0.04,
        "volume_change": 0.0,
        "volume_volatility_20": 0.15,
        "drawdown": 0.0,
        "orderbook_imbalance": 0.0,
        "orderbook_spread": 2.0,
    }
    base_features.update(features_dict)
    return FeatureSnapshot(
        symbol=symbol,
        timestamp=datetime.now(timezone.utc),
        feature_version="v1.0",
        features=base_features,
        warmup_periods_used=100,
    )


def test_classifier_bullish_trend() -> None:
    """Verify strong upward indicators classify as BULLISH_TREND with bounded confidence."""
    classifier = RuleBasedMarketStateClassifier()
    snapshot = _create_snapshot({
        "close": 65000.0,
        "ema_12": 64500.0,
        "ema_26": 62000.0,
        "sma_20": 63500.0,
        "sma_50": 60000.0,
        "trend_strength": 0.058,
        "rsi_14": 64.5,
        "macd": 120.0,
        "macd_signal": 80.0,
        "macd_hist": 40.0,
        "momentum_10": 0.045,
        "bb_bandwidth": 0.05,
        "orderbook_imbalance": 0.10,
    })

    result = classifier.classify(snapshot)
    assert result.state == MarketState.BULLISH_TREND
    assert 0.05 <= result.confidence <= 0.95
    assert result.confidence > 0.60
    assert result.symbol == "BTC"
    assert len(result.evidence) > 0
    assert any(e.supports_state == MarketState.BULLISH_TREND for e in result.evidence)
    assert "BULLISH_TREND" in result.primary_rationale


def test_classifier_bearish_trend() -> None:
    """Verify strong downward indicators classify as BEARISH_TREND with bounded confidence."""
    classifier = RuleBasedMarketStateClassifier()
    snapshot = _create_snapshot({
        "close": 42000.0,
        "ema_12": 43000.0,
        "ema_26": 46000.0,
        "sma_20": 44000.0,
        "sma_50": 48000.0,
        "trend_strength": -0.083,
        "rsi_14": 34.2,
        "macd": -150.0,
        "macd_signal": -90.0,
        "macd_hist": -60.0,
        "momentum_10": -0.065,
        "bb_bandwidth": 0.055,
        "orderbook_imbalance": -0.10,
    })

    result = classifier.classify(snapshot)
    assert result.state == MarketState.BEARISH_TREND
    assert 0.05 <= result.confidence <= 0.95
    assert result.confidence > 0.60
    assert any(e.supports_state == MarketState.BEARISH_TREND for e in result.evidence)
    assert "BEARISH_TREND" in result.primary_rationale


def test_classifier_sideways() -> None:
    """Verify flat moving averages and neutral oscillators classify as SIDEWAYS."""
    classifier = RuleBasedMarketStateClassifier()
    snapshot = _create_snapshot({
        "close": 50050.0,
        "ema_12": 50020.0,
        "ema_26": 50010.0,
        "sma_20": 50030.0,
        "sma_50": 50000.0,
        "trend_strength": 0.0006,  # tightly clustered
        "rsi_14": 50.2,            # neutral
        "macd": 0.5,
        "macd_signal": 0.4,
        "macd_hist": 0.1,          # flat histogram
        "momentum_10": 0.001,      # negligible momentum
        "bb_bandwidth": 0.035,     # subdued envelope
    })

    result = classifier.classify(snapshot)
    assert result.state == MarketState.SIDEWAYS
    assert 0.05 <= result.confidence <= 0.95
    assert any(e.supports_state == MarketState.SIDEWAYS for e in result.evidence)


def test_classifier_high_volatility() -> None:
    """Verify wide Bollinger bandwidth and elevated ATR trigger HIGH_VOLATILITY regime."""
    classifier = RuleBasedMarketStateClassifier()
    snapshot = _create_snapshot({
        "close": 50000.0,
        "bb_bandwidth": 0.095,      # > 0.07 threshold
        "volatility_20": 0.048,     # > 0.030 threshold
        "atr_14": 1800.0,           # 3.6% of price > 2.5%
        "trend_strength": 0.005,
        "rsi_14": 51.0,
    })

    result = classifier.classify(snapshot)
    assert result.state == MarketState.HIGH_VOLATILITY
    assert 0.05 <= result.confidence <= 0.95
    assert any(e.supports_state == MarketState.HIGH_VOLATILITY for e in result.evidence)


def test_classifier_low_volatility() -> None:
    """Verify compressed Bollinger bandwidth and low ATR trigger LOW_VOLATILITY regime."""
    classifier = RuleBasedMarketStateClassifier()
    snapshot = _create_snapshot({
        "close": 50000.0,
        "bb_bandwidth": 0.019,      # < 0.028 threshold
        "volatility_20": 0.008,     # < 0.012 threshold
        "atr_14": 300.0,            # 0.6% of price < 1.0%
        "trend_strength": 0.002,
        "rsi_14": 49.5,
    })

    result = classifier.classify(snapshot)
    assert result.state == MarketState.LOW_VOLATILITY
    assert 0.05 <= result.confidence <= 0.95
    assert any(e.supports_state == MarketState.LOW_VOLATILITY for e in result.evidence)


def test_classifier_accumulation_like() -> None:
    """Verify bid imbalance, stabilizing drawdown, and volume expansion classify as ACCUMULATION_LIKE."""
    classifier = RuleBasedMarketStateClassifier()
    snapshot = _create_snapshot({
        "close": 45000.0,
        "orderbook_imbalance": 0.42,   # heavy bid liquidity
        "rsi_14": 44.0,                # accumulation zone 35-52
        "volume_change": 0.28,         # volume expanding
        "returns": 0.002,              # price absorbing volume without moving
        "drawdown": -0.07,             # post-pullback base
        "momentum_10": 0.002,
        "trend_strength": 0.004,
    })

    result = classifier.classify(snapshot)
    assert result.state == MarketState.ACCUMULATION_LIKE
    assert 0.05 <= result.confidence <= 0.95
    assert any(e.supports_state == MarketState.ACCUMULATION_LIKE for e in result.evidence)


def test_classifier_distribution_like() -> None:
    """Verify ask imbalance, high RSI stall, and volume churn classify as DISTRIBUTION_LIKE."""
    classifier = RuleBasedMarketStateClassifier()
    snapshot = _create_snapshot({
        "close": 68000.0,
        "orderbook_imbalance": -0.38,  # heavy ask liquidity wall
        "rsi_14": 62.0,                # distribution zone 52-72
        "volume_change": 0.25,         # high volume turnover
        "returns": -0.004,             # negative/stagnant returns despite volume
        "trend_strength": 0.005,
    })

    result = classifier.classify(snapshot)
    assert result.state == MarketState.DISTRIBUTION_LIKE
    assert 0.05 <= result.confidence <= 0.95
    assert any(e.supports_state == MarketState.DISTRIBUTION_LIKE for e in result.evidence)


def test_classifier_uncertain_on_direct_conflict() -> None:
    """Verify contradictory signals (e.g. bullish price vs bearish orderbook and RSI) trigger UNCERTAIN."""
    classifier = RuleBasedMarketStateClassifier()
    snapshot = _create_snapshot({
        "close": 60000.0,
        "ema_12": 61000.0,
        "ema_26": 58000.0,             # bullish EMA cross
        "trend_strength": 0.04,        # bullish trend strength
        "rsi_14": 42.0,                # bearish RSI divergence
        "macd_hist": -25.0,            # bearish MACD divergence
        "orderbook_imbalance": -0.45,  # heavy ask wall opposing price
    })

    result = classifier.classify(snapshot)
    assert result.conflict_detected is True
    assert result.conflict_score >= 0.30
    assert result.state == MarketState.UNCERTAIN
    assert 0.05 <= result.confidence <= 0.95
    assert "UNCERTAIN" in result.primary_rationale


def test_classifier_uncertain_on_sparse_features() -> None:
    """Verify uninformative / near-zero indicator snapshot classifies as UNCERTAIN."""
    classifier = RuleBasedMarketStateClassifier()
    snapshot = _create_snapshot({
        "close": 100.0,
        "ema_12": 0.0,
        "ema_26": 0.0,
        "sma_20": 0.0,
        "sma_50": 0.0,
        "trend_strength": 0.0,
        "rsi_14": 50.0,
        "macd": 0.0,
        "macd_signal": 0.0,
        "macd_hist": 0.0,
        "momentum_10": 0.0,
        "bb_bandwidth": 0.04,
        "orderbook_imbalance": 0.0,
    })

    result = classifier.classify(snapshot)
    assert result.state in (MarketState.UNCERTAIN, MarketState.SIDEWAYS)
    assert 0.05 <= result.confidence <= 0.95


def test_confidence_validation_bounds() -> None:
    """Verify MarketStateResult strictly rejects confidence outside [0.05, 0.95]."""
    # Over 0.95 rejected (1.0 cannot exist)
    with pytest.raises(ValidationError):
        MarketStateResult(
            symbol="BTC",
            state=MarketState.BULLISH_TREND,
            confidence=1.0,
            primary_rationale="Certain",
        )

    # Over 0.95 rejected
    with pytest.raises(ValidationError):
        MarketStateResult(
            symbol="BTC",
            state=MarketState.BULLISH_TREND,
            confidence=0.96,
            primary_rationale="Overconfident",
        )

    # Under 0.05 rejected (0.0 cannot exist)
    with pytest.raises(ValidationError):
        MarketStateResult(
            symbol="BTC",
            state=MarketState.UNCERTAIN,
            confidence=0.0,
            primary_rationale="Zero confidence",
        )

    # Valid bounds accepted
    valid_res = MarketStateResult(
        symbol="BTC",
        state=MarketState.BULLISH_TREND,
        confidence=0.85,
        primary_rationale="High evidence",
    )
    assert valid_res.confidence == 0.85


@pytest.mark.asyncio
async def test_market_state_service_end_to_end() -> None:
    """Verify MarketStateService end-to-end execution with mock provider data."""
    service = MarketStateService()
    result = await service.get_market_state("BTC", timeframe="1h", limit=100)

    assert isinstance(result, MarketStateResult)
    assert result.symbol == "BTC"
    assert isinstance(result.state, MarketState)
    assert 0.05 <= result.confidence <= 0.95
    assert len(result.evidence) > 0
    assert len(result.state_scores) == 8
    assert result.warmup_periods_used >= 5
    assert isinstance(result.primary_rationale, str)
    assert len(result.primary_rationale) > 10


def test_conflict_analyzer_direct() -> None:
    """Verify ConflictAnalyzer computes correct conflict metrics and flags."""
    features = {
        "trend_strength": 0.035,
        "rsi_14": 40.0,
        "macd_hist": -1.2,
        "orderbook_imbalance": -0.35,
    }
    scores = {
        MarketState.BULLISH_TREND: 3.5,
        MarketState.BEARISH_TREND: 3.0,
        MarketState.SIDEWAYS: 0.5,
    }
    detected, score, conflicts = ConflictAnalyzer.analyze_conflicts(features, scores, [])
    assert detected is True
    assert score >= 0.30
    assert len(conflicts) >= 2


def test_custom_thresholds_override() -> None:
    """Verify custom thresholds alter classifier behavior as configured."""
    strict_thresholds = MarketStateThresholds(
        rsi_bullish=75.0,  # very strict RSI requirement
    )
    classifier = RuleBasedMarketStateClassifier(thresholds=strict_thresholds)
    snapshot = _create_snapshot({
        "rsi_14": 65.0,  # Below strict 75.0
        "ema_12": 52000.0,
        "ema_26": 50000.0,
        "trend_strength": 0.02,
    })
    result = classifier.classify(snapshot)
    # RSI evidence item should not be present since 65 < 75
    rsi_items = [e for e in result.evidence if e.indicator == "RSI_14"]
    assert len(rsi_items) == 0


def test_zero_close_resilience() -> None:
    """Verify classifier safely handles degenerate zero close without throwing ZeroDivisionError."""
    classifier = RuleBasedMarketStateClassifier()
    snapshot = _create_snapshot({
        "close": 0.0,
        "atr_14": 0.0,
        "macd_hist": 0.0,
    })
    result = classifier.classify(snapshot)
    assert isinstance(result, MarketStateResult)
    assert 0.05 <= result.confidence <= 0.95


def test_market_state_scores_schema() -> None:
    """Verify MarketStateScores model instantiation and validation."""
    scores = MarketStateScores(
        bullish_trend=4.2,
        bearish_trend=1.0,
        sideways=0.5,
    )
    assert scores.bullish_trend == 4.2
    assert scores.uncertain == 0.0

