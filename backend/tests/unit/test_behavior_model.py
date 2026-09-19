"""Unit tests for Observable Behavior Model, liquidity metrics, and participant flow archetypes."""

from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from app.schemas.behavior import (
    BehaviorAnalysisResult,
    BehaviorState,
    LiquidityPressure,
    ObservationItem,
    ParticipantArchetype,
    WhaleActivityIndicator,
)
from app.schemas.features import FeatureSnapshot
from app.schemas.market import CanonicalOrderBook, OrderBookLevel
from app.services.behavior_model.liquidity_model import LiquidityModel
from app.services.behavior_model.participant_model import ParticipantModel
from app.services.behavior_model.service import BehaviorModelService
from app.services.behavior_model.whale_activity import WhaleActivityDetector


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


def _create_orderbook(
    bid_qty: float = 10.0,
    ask_qty: float = 10.0,
    spread: float = 2.0,
    mid_price: float = 50000.0,
    bid_wall: Optional[float] = None,
    ask_wall: Optional[float] = None,
) -> CanonicalOrderBook:
    """Helper creating a synthetic CanonicalOrderBook."""
    bids = [
        OrderBookLevel(price=mid_price - (spread / 2.0) - (i * 5.0), quantity=bid_qty)
        for i in range(5)
    ]
    asks = [
        OrderBookLevel(price=mid_price + (spread / 2.0) + (i * 5.0), quantity=ask_qty)
        for i in range(5)
    ]
    if bid_wall:
        bids[0] = OrderBookLevel(price=mid_price - (spread / 2.0), quantity=bid_wall)
    if ask_wall:
        asks[0] = OrderBookLevel(price=mid_price + (spread / 2.0), quantity=ask_wall)

    return CanonicalOrderBook(
        symbol="BTC",
        bids=bids,
        asks=asks,
        spread=spread,
        timestamp=datetime.now(timezone.utc),
    )


# ==============================================================================
# Liquidity & Microstructure Tests
# ==============================================================================

def test_liquidity_model_balanced_and_asymmetric() -> None:
    """Verify LiquidityModel computes depth imbalance and basis point spread correctly."""
    # 1. Balanced book
    ob_balanced = _create_orderbook(bid_qty=10.0, ask_qty=10.0, spread=2.0, mid_price=50000.0)
    pressure_bal, obs_bal = LiquidityModel.evaluate_liquidity(ob_balanced, close_price=50000.0)

    assert pressure_bal.net_imbalance == 0.0
    assert pressure_bal.spread_bps == 0.4  # (2.0 / 50000) * 10000 = 0.4 bps
    assert pressure_bal.depth_resilience == "HIGH"
    assert len(obs_bal) >= 2

    # 2. Asymmetric book with bid wall
    ob_asym = _create_orderbook(bid_qty=50.0, ask_qty=10.0, spread=10.0, mid_price=50000.0)
    pressure_asym, obs_asym = LiquidityModel.evaluate_liquidity(ob_asym, close_price=50000.0)

    assert pressure_asym.net_imbalance > 0.50
    assert pressure_asym.depth_resilience == "ASYMMETRIC"


# ==============================================================================
# Whale Activity Detection Tests
# ==============================================================================

def test_whale_activity_detector_wall_and_absorption() -> None:
    """Verify WhaleActivityDetector identifies localized limit walls and absorption ratios."""
    ob = _create_orderbook(bid_qty=5.0, ask_qty=5.0, bid_wall=50.0)  # 50 vs 4*5=20 -> > 70% of side
    snap = _create_snapshot({
        "volume_change": 0.35,
        "volume_volatility_20": 0.40,
        "returns": 0.001,  # high volume with tiny price movement = absorption
    })

    indicator, obs = WhaleActivityDetector.detect_whale_activity(snap, ob)

    assert indicator.wall_detected is True
    assert indicator.wall_side == "BID"
    assert indicator.concentration_score > 0.50
    assert indicator.absorption_ratio > 1.5
    assert any("RESTING_BID_WALL" in o.metric for o in obs)
    assert any("ABSORPTION_SIGNATURE" in o.metric for o in obs)


# ==============================================================================
# Participant Flow & Behavioral State Tests
# ==============================================================================

def test_participant_model_institutional_accumulation() -> None:
    """Verify bid imbalance and absorption footprint classify as ACCUMULATION_LIKE."""
    liquidity = LiquidityPressure(
        bid_pressure=50.0,
        ask_pressure=10.0,
        net_imbalance=0.66,
        spread_bps=2.5,
        depth_resilience="ASYMMETRIC",
    )
    whale = WhaleActivityIndicator(
        wall_detected=True,
        wall_side="BID",
        concentration_score=0.65,
        absorption_ratio=2.2,
    )
    snap = _create_snapshot({
        "rsi_14": 46.0,
        "volume_change": 0.25,
        "returns": 0.002,
    })

    state, conf, archetype, breakdown, summary = ParticipantModel.infer_behavior(
        snap, liquidity, whale, []
    )

    assert state == BehaviorState.ACCUMULATION_LIKE
    assert archetype in (
        ParticipantArchetype.INSTITUTIONAL_ACCUMULATION,
        ParticipantArchetype.WHALE_PASSIVE_ABSORPTION,
    )
    assert 0.05 <= conf <= 0.95
    assert breakdown[archetype.value] > 0.20


def test_participant_model_institutional_distribution() -> None:
    """Verify ask imbalance and overhead supply footprint classify as DISTRIBUTION_LIKE."""
    liquidity = LiquidityPressure(
        bid_pressure=10.0,
        ask_pressure=50.0,
        net_imbalance=-0.66,
        spread_bps=3.0,
        depth_resilience="ASYMMETRIC",
    )
    whale = WhaleActivityIndicator(
        wall_detected=True,
        wall_side="ASK",
        concentration_score=0.65,
        absorption_ratio=1.8,
    )
    snap = _create_snapshot({
        "rsi_14": 62.0,
        "volume_change": 0.20,
        "returns": -0.003,
    })

    state, conf, archetype, breakdown, summary = ParticipantModel.infer_behavior(
        snap, liquidity, whale, []
    )

    assert state == BehaviorState.DISTRIBUTION_LIKE
    assert archetype in (
        ParticipantArchetype.INSTITUTIONAL_DISTRIBUTION,
        ParticipantArchetype.WHALE_PASSIVE_ABSORPTION,
    )
    assert 0.05 <= conf <= 0.95


def test_participant_model_retail_fomo_and_panic() -> None:
    """Verify extreme momentum and volatility classify into RETAIL_FOMO and RETAIL_PANIC."""
    liquidity = LiquidityPressure(
        bid_pressure=10.0,
        ask_pressure=10.0,
        net_imbalance=0.0,
        spread_bps=8.0,
        depth_resilience="MODERATE",
    )
    whale = WhaleActivityIndicator(wall_detected=False, concentration_score=0.2)

    # Retail FOMO
    fomo_snap = _create_snapshot({
        "rsi_14": 78.0,
        "returns": 0.035,
        "volatility_20": 0.045,
    })
    state_fomo, conf_fomo, arch_fomo, _, _ = ParticipantModel.infer_behavior(
        fomo_snap, liquidity, whale, []
    )
    assert state_fomo == BehaviorState.RETAIL_FOMO
    assert arch_fomo == ParticipantArchetype.RETAIL_DOMINATED

    # Retail Panic
    panic_snap = _create_snapshot({
        "rsi_14": 22.0,
        "returns": -0.045,
        "drawdown": -0.08,
        "volatility_20": 0.050,
    })
    state_panic, conf_panic, arch_panic, _, _ = ParticipantModel.infer_behavior(
        panic_snap, liquidity, whale, []
    )
    assert state_panic == BehaviorState.RETAIL_PANIC
    assert arch_panic == ParticipantArchetype.RETAIL_DOMINATED


def test_participant_model_market_making_balanced() -> None:
    """Verify tight spreads, balanced depth, and low volatility classify as MARKET_MAKING_BALANCED."""
    liquidity = LiquidityPressure(
        bid_pressure=20.0,
        ask_pressure=20.0,
        net_imbalance=0.0,
        spread_bps=2.0,
        depth_resilience="HIGH",
    )
    whale = WhaleActivityIndicator(wall_detected=False, concentration_score=0.1)
    snap = _create_snapshot({
        "rsi_14": 50.0,
        "returns": 0.001,
        "volatility_20": 0.015,
    })

    state, conf, archetype, breakdown, summary = ParticipantModel.infer_behavior(
        snap, liquidity, whale, []
    )
    assert state == BehaviorState.MARKET_MAKING_BALANCED
    assert archetype in (
        ParticipantArchetype.LIQUIDITY_PROVIDER_ACTIVE,
        ParticipantArchetype.ALGORITHMIC_HIGH_FREQUENCY,
    )


# ==============================================================================
# Confidence Bounds and Validation Tests
# ==============================================================================

def test_behavior_confidence_bounds_enforcement() -> None:
    """Verify strict rejection of confidence outside [0.05, 0.95]."""
    dummy_liq = LiquidityPressure(
        bid_pressure=1.0, ask_pressure=1.0, net_imbalance=0.0, spread_bps=2.0, depth_resilience="HIGH"
    )
    dummy_whale = WhaleActivityIndicator()

    # Rejection of 1.0 (certainty cannot exist)
    with pytest.raises(ValidationError):
        BehaviorAnalysisResult(
            symbol="BTC",
            behavior_state=BehaviorState.ACCUMULATION_LIKE,
            confidence=1.0,
            primary_participant=ParticipantArchetype.INSTITUTIONAL_ACCUMULATION,
            summary="Invalid",
            liquidity_pressure=dummy_liq,
            whale_activity=dummy_whale,
        )

    # Rejection of 0.0
    with pytest.raises(ValidationError):
        BehaviorAnalysisResult(
            symbol="BTC",
            behavior_state=BehaviorState.UNCERTAIN,
            confidence=0.0,
            primary_participant=ParticipantArchetype.MIXED_UNRESOLVED,
            summary="Invalid",
            liquidity_pressure=dummy_liq,
            whale_activity=dummy_whale,
        )


# ==============================================================================
# Service End-to-End Test
# ==============================================================================

@pytest.mark.asyncio
async def test_behavior_service_end_to_end() -> None:
    """Verify BehaviorModelService end-to-end execution with mock provider data."""
    service = BehaviorModelService()
    result = await service.analyze_behavior(symbol="BTC", timeframe="1h", limit=100)

    assert isinstance(result, BehaviorAnalysisResult)
    assert result.symbol == "BTC"
    assert isinstance(result.behavior_state, BehaviorState)
    assert isinstance(result.primary_participant, ParticipantArchetype)
    assert 0.05 <= result.confidence <= 0.95
    assert len(result.observations) > 0
    assert len(result.participant_breakdown) == 7
    assert isinstance(result.summary, str)
    assert len(result.summary) > 10
    assert result.liquidity_pressure is not None
    assert result.whale_activity is not None
