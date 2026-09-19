"""Unit tests for Quantitative Signal Engine, individual strategies, and aggregator ensemble."""

from datetime import datetime, timezone
import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import MarketState, MarketStateResult
from app.schemas.signals import (
    AggregatedSignalResult,
    SignalDirection,
    StrategySignal,
    TimeHorizon,
)
from app.services.signal_engine.aggregator import (
    MAX_STRATEGY_WEIGHT_SHARE,
    SignalAggregator,
)
from app.services.signal_engine.mean_reversion import MeanReversionStrategy
from app.services.signal_engine.ml_signal import MultiFactorMLStrategy
from app.services.signal_engine.momentum import MomentumStrategy
from app.services.signal_engine.service import SignalService
from app.services.signal_engine.technical import TechnicalStrategy
from app.services.signal_engine.volatility import VolatilityStrategy


def _create_snapshot(features_dict: dict, symbol: str = "BTC") -> FeatureSnapshot:
    """Helper creating a FeatureSnapshot with baseline indicator defaults."""
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


def _create_regime(state: MarketState = MarketState.SIDEWAYS) -> MarketStateResult:
    """Helper creating a dummy MarketStateResult."""
    return MarketStateResult(
        symbol="BTC",
        state=state,
        confidence=0.75,
        primary_rationale=f"Market in {state.value}",
        conflict_detected=False,
        conflict_score=0.0,
    )


# ==============================================================================
# Individual Strategy Tests
# ==============================================================================

def test_technical_strategy_bullish() -> None:
    """Verify TechnicalStrategy yields LONG on upward moving averages."""
    strategy = TechnicalStrategy()
    snapshot = _create_snapshot({
        "close": 55000.0,
        "ema_12": 54000.0,
        "ema_26": 51000.0,
        "sma_20": 53000.0,
        "sma_50": 50000.0,
        "trend_strength": 0.045,
    })
    regime = _create_regime(MarketState.BULLISH_TREND)
    sig = strategy.generate_signal(snapshot, regime)

    assert sig.direction == SignalDirection.LONG
    assert 0.05 <= sig.confidence <= 0.95
    assert 0.0 <= sig.strength <= 1.0
    assert len(sig.reasons) > 0


def test_technical_strategy_bearish() -> None:
    """Verify TechnicalStrategy yields SHORT on downward moving averages."""
    strategy = TechnicalStrategy()
    snapshot = _create_snapshot({
        "close": 44000.0,
        "ema_12": 45000.0,
        "ema_26": 48000.0,
        "sma_20": 46000.0,
        "sma_50": 50000.0,
        "trend_strength": -0.050,
    })
    regime = _create_regime(MarketState.BEARISH_TREND)
    sig = strategy.generate_signal(snapshot, regime)

    assert sig.direction == SignalDirection.SHORT
    assert 0.05 <= sig.confidence <= 0.95


def test_momentum_strategy_bullish_and_bearish() -> None:
    """Verify MomentumStrategy responds to RSI and MACD velocity."""
    strategy = MomentumStrategy()

    bull_snap = _create_snapshot({
        "rsi_14": 62.0,
        "macd": 80.0,
        "macd_signal": 50.0,
        "macd_hist": 30.0,
        "momentum_10": 0.035,
    })
    sig_bull = strategy.generate_signal(bull_snap)
    assert sig_bull.direction == SignalDirection.LONG

    bear_snap = _create_snapshot({
        "rsi_14": 38.0,
        "macd": -80.0,
        "macd_signal": -50.0,
        "macd_hist": -30.0,
        "momentum_10": -0.035,
    })
    sig_bear = strategy.generate_signal(bear_snap)
    assert sig_bear.direction == SignalDirection.SHORT


def test_mean_reversion_strategy_setups_and_regime_protection() -> None:
    """Verify MeanReversionStrategy trades extremes in ranges but suppresses in strong trends."""
    strategy = MeanReversionStrategy()

    # Oversold in Sideways -> Long
    oversold_snap = _create_snapshot({
        "rsi_14": 26.0,
        "drawdown": -0.08,
        "trend_strength": 0.002,
    })
    sig_oversold = strategy.generate_signal(oversold_snap, _create_regime(MarketState.SIDEWAYS))
    assert sig_oversold.direction == SignalDirection.LONG

    # Regime Protection: strong trend suppresses mean reversion
    strong_trend_snap = _create_snapshot({
        "rsi_14": 26.0,
        "trend_strength": -0.06,  # Strong downtrend
    })
    sig_protected = strategy.generate_signal(strong_trend_snap, _create_regime(MarketState.BEARISH_TREND))
    assert sig_protected.direction == SignalDirection.HOLD
    assert any("suppressed" in r.lower() for r in sig_protected.reasons)


def test_volatility_strategy_high_and_low_regimes() -> None:
    """Verify VolatilityStrategy triggers defense in high volatility and breakout in low volatility."""
    strategy = VolatilityStrategy()

    # High Volatility -> HOLD
    hi_vol_snap = _create_snapshot({
        "bb_bandwidth": 0.095,
        "volatility_20": 0.045,
    })
    sig_hi = strategy.generate_signal(hi_vol_snap, _create_regime(MarketState.HIGH_VOLATILITY))
    assert sig_hi.direction == SignalDirection.HOLD

    # Low Volatility Squeeze with positive momentum -> LONG
    lo_vol_snap = _create_snapshot({
        "bb_bandwidth": 0.020,
        "momentum_10": 0.018,
    })
    sig_lo = strategy.generate_signal(lo_vol_snap, _create_regime(MarketState.LOW_VOLATILITY))
    assert sig_lo.direction == SignalDirection.LONG


def test_multi_factor_ml_strategy() -> None:
    """Verify MultiFactorMLStrategy scores multi-dimensional factors accurately."""
    strategy = MultiFactorMLStrategy()

    bull_snap = _create_snapshot({
        "trend_strength": 0.04,
        "rsi_14": 65.0,
        "orderbook_imbalance": 0.35,
        "drawdown": 0.0,
    })
    sig_bull = strategy.generate_signal(bull_snap)
    assert sig_bull.direction == SignalDirection.LONG
    assert sig_bull.metrics["composite_score"] > 0.20

    bear_snap = _create_snapshot({
        "trend_strength": -0.04,
        "rsi_14": 35.0,
        "orderbook_imbalance": -0.35,
        "drawdown": -0.12,
    })
    sig_bear = strategy.generate_signal(bear_snap)
    assert sig_bear.direction == SignalDirection.SHORT
    assert sig_bear.metrics["composite_score"] < -0.20


# ==============================================================================
# Aggregator & Domination Guard Tests
# ==============================================================================

def test_signal_aggregator_domination_guard() -> None:
    """Verify no single strategy can exceed MAX_STRATEGY_WEIGHT_SHARE (35%)."""
    # Create an aggregator where one strategy is given an excessive weight of 100.0
    dominant_strat = TechnicalStrategy(weight=100.0)
    strat2 = MomentumStrategy(weight=1.0)
    strat3 = MeanReversionStrategy(weight=1.0)
    strat4 = VolatilityStrategy(weight=1.0)
    aggregator = SignalAggregator(strategies=[dominant_strat, strat2, strat3, strat4])

    weights = aggregator._get_regime_weights(None)
    total_weight = sum(weights.values())

    for name, w in weights.items():
        share = w / total_weight
        assert share <= MAX_STRATEGY_WEIGHT_SHARE + 1e-4, f"{name} exceeded max share: {share:.2%}"


def test_signal_aggregator_consensus_and_explainability() -> None:
    """Verify aggregator produces consensus and preserves individual strategy outputs."""
    aggregator = SignalAggregator()
    bullish_snapshot = _create_snapshot({
        "close": 65000.0,
        "ema_12": 64000.0,
        "ema_26": 61000.0,
        "sma_20": 63000.0,
        "sma_50": 60000.0,
        "trend_strength": 0.05,
        "rsi_14": 64.0,
        "macd": 100.0,
        "macd_signal": 50.0,
        "macd_hist": 50.0,
        "momentum_10": 0.04,
        "orderbook_imbalance": 0.25,
    })
    regime = _create_regime(MarketState.BULLISH_TREND)
    result = aggregator.aggregate(bullish_snapshot, regime)

    assert isinstance(result, AggregatedSignalResult)
    assert result.direction == SignalDirection.LONG
    assert 0.05 <= result.confidence <= 0.95
    assert 0.0 <= result.strength <= 1.0
    assert len(result.strategy_signals) == 5
    assert "consensus_metrics" in result.model_dump()
    assert result.consensus_metrics["strategies_evaluated"] == 5
    # Confirm individual strategy explainability
    strategy_names = [s.strategy_name for s in result.strategy_signals]
    assert "TechnicalStrategy" in strategy_names
    assert "MomentumStrategy" in strategy_names
    assert "MeanReversionStrategy" in strategy_names
    assert "VolatilityStrategy" in strategy_names
    assert "MultiFactorMLStrategy" in strategy_names


def test_signal_aggregator_uncertain_regime_damping() -> None:
    """Verify macro UNCERTAIN regime dampens aggregate confidence and applies caution."""
    aggregator = SignalAggregator()
    snapshot = _create_snapshot({
        "trend_strength": 0.03,
        "rsi_14": 60.0,
        "macd_hist": 20.0,
    })
    uncertain_regime = MarketStateResult(
        symbol="BTC",
        state=MarketState.UNCERTAIN,
        confidence=0.30,
        primary_rationale="Conflict detected",
        conflict_detected=True,
        conflict_score=0.85,
    )
    result = aggregator.aggregate(snapshot, uncertain_regime)
    assert any("regime caution" in r.lower() for r in result.reasons)
    assert 0.05 <= result.confidence <= 0.95


def test_strategy_signal_and_aggregated_signal_validators() -> None:
    """Verify strict validation of confidence bounds [0.05, 0.95] and strength [0.0, 1.0]."""
    # Over 0.95 confidence rejected
    with pytest.raises(ValidationError):
        StrategySignal(
            strategy_name="Test",
            asset="BTC",
            direction=SignalDirection.LONG,
            confidence=1.0,
            strength=0.5,
        )

    # Under 0.05 confidence rejected
    with pytest.raises(ValidationError):
        StrategySignal(
            strategy_name="Test",
            asset="BTC",
            direction=SignalDirection.LONG,
            confidence=0.01,
            strength=0.5,
        )

    # Over 1.0 strength rejected
    with pytest.raises(ValidationError):
        StrategySignal(
            strategy_name="Test",
            asset="BTC",
            direction=SignalDirection.LONG,
            confidence=0.80,
            strength=1.5,
        )


@pytest.mark.asyncio
async def test_signal_service_end_to_end(db_session: AsyncSession) -> None:
    """Verify SignalService end-to-end execution and DB repository persistence."""
    service = SignalService()
    result = await service.get_signal(
        symbol="BTC",
        timeframe="1h",
        limit=100,
        session=db_session,
    )

    assert isinstance(result, AggregatedSignalResult)
    assert result.asset == "BTC"
    assert isinstance(result.direction, SignalDirection)
    assert 0.05 <= result.confidence <= 0.95
    assert len(result.strategy_signals) == 5

    # Verify signal persistence in repository
    history = await service.get_recent_signals(symbol="BTC", limit=10, session=db_session)
    assert len(history) >= 1
    assert history[0].symbol == "BTC"
    assert history[0].direction == result.direction
