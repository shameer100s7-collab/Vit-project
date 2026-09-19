"""Unit tests for the GHOST Courtroom adversarial reasoning engine."""

from datetime import datetime, timezone
import pytest

from app.schemas.courtroom import (
    CourtroomCaseCreate,
    EvidenceDirection,
    EvidenceHierarchy,
    EvidenceStrength,
    ThesisStance,
    VerdictType,
)
from app.schemas.market import (
    CanonicalCandle,
    CanonicalOrderBook,
    CanonicalPrice,
    CanonicalVolume,
    OrderBookLevel,
)
from app.services.courtroom.engine import CourtroomEngine


@pytest.fixture
def engine() -> CourtroomEngine:
    return CourtroomEngine()


@pytest.fixture
def sample_candles() -> list[CanonicalCandle]:
    """Generates 50 realistic sequential 4h candles."""
    now = datetime.now(timezone.utc)
    base_price = 80000.0
    candles = []
    for i in range(50):
        # Gradual upward drift with some volatility
        p_open = base_price + (i * 50) + ((i % 3) * 20)
        p_close = p_open + 30.0 - ((i % 2) * 15)
        p_high = max(p_open, p_close) + 40.0
        p_low = min(p_open, p_close) - 35.0
        vol = 150.0 + ((i % 5) * 20)
        candles.append(
            CanonicalCandle(
                symbol="BTCUSDT",
                timeframe="4h",
                timestamp=now,
                open=p_open,
                high=p_high,
                low=p_low,
                close=p_close,
                volume=vol,
                source="Binance Spot",
            )
        )
    return candles


@pytest.fixture
def sample_ticker() -> CanonicalVolume:
    return CanonicalVolume(
        symbol="BTCUSDT",
        volume_24h=12500.5,
        quote_volume_24h=1020000000.0,
        high_24h=83500.0,
        low_24h=79800.0,
        price_change_24h=1200.0,
        price_change_pct_24h=1.48,
        source="Binance Spot",
    )


@pytest.fixture
def sample_price() -> CanonicalPrice:
    return CanonicalPrice(
        symbol="BTCUSDT",
        price=82150.0,
        source="Binance Spot",
    )


@pytest.fixture
def sample_orderbook() -> CanonicalOrderBook:
    return CanonicalOrderBook(
        symbol="BTCUSDT",
        bids=[
            OrderBookLevel(price=82149.0, quantity=2.5),
            OrderBookLevel(price=82148.0, quantity=4.0),
        ],
        asks=[
            OrderBookLevel(price=82151.0, quantity=1.8),
            OrderBookLevel(price=82152.0, quantity=3.2),
        ],
        source="Binance Spot",
    )


def test_stance_detection(engine: CourtroomEngine):
    """Verifies natural language interpretation of various user statements."""
    assert engine.detect_stance("I think Bitcoin is bullish because momentum is increasing") == ThesisStance.BULLISH
    assert engine.detect_stance("BTC is going to break resistance and rally") == ThesisStance.BULLISH
    assert engine.detect_stance("I believe ETH will break down below support") == ThesisStance.BEARISH
    assert engine.detect_stance("Market looks completely sideways and range-bound") == ThesisStance.NEUTRAL_OR_RANGE
    assert engine.detect_stance("SOL is in a massive downtrend dump") == ThesisStance.BEARISH


def test_bullish_adversarial_proceeding(
    engine: CourtroomEngine,
    sample_candles: list[CanonicalCandle],
    sample_ticker: CanonicalVolume,
    sample_price: CanonicalPrice,
    sample_orderbook: CanonicalOrderBook,
):
    """Verifies that Courtroom rigorously challenges a bullish thesis while providing balanced defense."""
    submission = CourtroomCaseCreate(
        symbol="BTCUSDT",
        timeframe="4h",
        thesis="I think BTC is bullish because it is in a clear uptrend.",
        support_level=81000.0,
        resistance_level=84000.0,
    )

    case = engine.evaluate_case(
        case_id="CASE-TEST-0001",
        submission=submission,
        candles=sample_candles,
        ticker=sample_ticker,
        price=sample_price,
        order_book=sample_orderbook,
    )

    assert case.case_id == "CASE-TEST-0001"
    assert case.detected_stance == ThesisStance.BULLISH
    assert case.symbol == "BTCUSDT"
    assert case.status == "IN_SESSION"

    # Prosecution should present arguments attacking the thesis
    assert len(case.prosecution_arguments) >= 2
    for arg in case.prosecution_arguments:
        assert arg.role == "PROSECUTION"
        assert arg.strength in [EvidenceStrength.STRONG, EvidenceStrength.MODERATE, EvidenceStrength.WEAK]
        assert arg.source == "Binance Spot"
        assert len(arg.evidence_items) > 0
        for ev in arg.evidence_items:
            assert ev.direction == EvidenceDirection.OPPOSING

    # Defense should present arguments supporting the thesis
    assert len(case.defense_arguments) >= 2
    for arg in case.defense_arguments:
        assert arg.role == "DEFENSE"
        assert arg.source == "Binance Spot"
        assert len(arg.evidence_items) > 0
        for ev in arg.evidence_items:
            assert ev.direction == EvidenceDirection.SUPPORTING

    # Cross-examination matrix must expose contradictions
    assert len(case.cross_examination) >= 4
    dimensions = [row.dimension for row in case.cross_examination]
    assert "Momentum & Velocity" in dimensions
    assert "Trend Structure" in dimensions
    assert "Order Flow & Depth" in dimensions

    # Invalidation conditions must exist and be strictly non-signals
    assert len(case.invalidation_conditions) >= 2
    for inv in case.invalidation_conditions:
        assert inv.condition_type == "BULLISH_INVALIDATION"
        assert "buy" not in inv.description.lower()
        assert "sell" not in inv.description.lower()
        assert inv.rationale != ""

    # Verdict must be one of the permitted analytical types
    assert case.verdict in [
        VerdictType.SUPPORTED,
        VerdictType.PARTIALLY_SUPPORTED,
        VerdictType.WEAKENED,
        VerdictType.CONTRADICTED,
        VerdictType.INCONCLUSIVE,
        VerdictType.NO_CLEAR_VERDICT,
    ]


def test_bearish_adversarial_proceeding(
    engine: CourtroomEngine,
    sample_candles: list[CanonicalCandle],
    sample_ticker: CanonicalVolume,
    sample_price: CanonicalPrice,
    sample_orderbook: CanonicalOrderBook,
):
    """Verifies that Courtroom inverts roles for a bearish thesis: prosecutor attacks bearish, defense defends bearish."""
    submission = CourtroomCaseCreate(
        symbol="ETHUSDT",
        timeframe="1h",
        thesis="I think ETH is going to crash and dump hard.",
    )

    case = engine.evaluate_case(
        case_id="CASE-TEST-0002",
        submission=submission,
        candles=sample_candles,
        ticker=sample_ticker,
        price=sample_price,
        order_book=sample_orderbook,
    )

    assert case.detected_stance == ThesisStance.BEARISH
    # Invalidation conditions must be bearish invalidations
    for inv in case.invalidation_conditions:
        assert inv.condition_type == "BEARISH_INVALIDATION"

    # Prosecution attacks bearish thesis
    for arg in case.prosecution_arguments:
        for ev in arg.evidence_items:
            assert ev.direction == EvidenceDirection.OPPOSING

    # Defense defends bearish thesis
    for arg in case.defense_arguments:
        for ev in arg.evidence_items:
            assert ev.direction == EvidenceDirection.SUPPORTING
