"""Unit tests for GHOST Market Context Engine and Screenshot Quality Gate."""

import base64
from datetime import datetime, timezone
import io
import numpy as np
from PIL import Image, ImageDraw
import pytest

from app.schemas.market import CanonicalCandle
from app.schemas.market_context import (
    EvidenceQuality,
    MarketContextRequest,
    MarketContextState,
    TimeframeScreenshot,
)
from app.services.market_context.engine import MarketContextEngine
from app.services.market_context.quality_gate import ScreenshotQualityGate


def create_mock_chart_image(width: int = 600, height: int = 400, add_candles: bool = True) -> str:
    """Generates a synthetic base64-encoded chart image with high contrast."""
    img = Image.new("RGB", (width, height), color=(15, 20, 28))
    draw = ImageDraw.Draw(img)

    if add_candles:
        # Draw grid lines
        for y in range(50, height, 50):
            draw.line([(0, y), (width, y)], fill=(35, 45, 60), width=1)
        for x in range(50, width, 50):
            draw.line([(x, 0), (x, height)], fill=(35, 45, 60), width=1)

        # Draw candlestick bodies and wicks
        x_start = 60
        step = 25
        for i in range(15):
            cx = x_start + (i * step)
            c_top = 100 + ((i % 5) * 20)
            c_bot = c_top + 40
            # Wicks
            draw.line([(cx + 4, c_top - 20), (cx + 4, c_bot + 20)], fill=(0, 220, 180), width=2)
            # Body
            draw.rectangle([(cx, c_top), (cx + 8, c_bot)], fill=(0, 200, 150), outline=(255, 255, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def create_solid_color_image(width: int = 100, height: int = 80) -> str:
    """Generates an invalid, low-res monochromatic image to fail quality gate."""
    img = Image.new("RGB", (width, height), color=(50, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@pytest.fixture
def quality_gate() -> ScreenshotQualityGate:
    return ScreenshotQualityGate()


@pytest.fixture
def engine() -> MarketContextEngine:
    return MarketContextEngine()


@pytest.fixture
def sample_candles() -> list[CanonicalCandle]:
    now = datetime.now(timezone.utc)
    candles = []
    for i in range(30):
        p_open = 80000.0 + (i * 40)
        p_close = p_open + 25.0
        p_high = p_close + 30.0
        p_low = p_open - 20.0
        candles.append(
            CanonicalCandle(
                symbol="BTCUSDT",
                timeframe="1h",
                timestamp=now,
                open=p_open,
                high=p_high,
                low=p_low,
                close=p_close,
                volume=120.0 + (i * 5),
                source="Binance Spot",
            )
        )
    return candles


def test_quality_gate_passes_on_clear_chart(quality_gate: ScreenshotQualityGate):
    """Verifies that a clear chart image passes quality gate with HIGH or MODERATE rating."""
    valid_b64 = create_mock_chart_image(width=800, height=500, add_candles=True)
    result = quality_gate.evaluate(image_data=valid_b64, asset="BTC/USDT", timeframe="1H")

    assert result.quality_gate_passed is True
    assert result.clarity_rating in (EvidenceQuality.HIGH, EvidenceQuality.MODERATE)
    assert result.candle_bodies_visible is True
    assert result.wicks_visible is True
    assert result.error_title is None


def test_quality_gate_fails_on_insufficient_image(quality_gate: ScreenshotQualityGate):
    """Verifies that low-res, monochromatic image is rejected with CHART CLARITY INSUFFICIENT."""
    invalid_b64 = create_solid_color_image(width=100, height=80)
    result = quality_gate.evaluate(image_data=invalid_b64, asset="BTC/USDT", timeframe="1H")

    assert result.quality_gate_passed is False
    assert result.clarity_rating == EvidenceQuality.INSUFFICIENT
    assert result.error_title == "CHART CLARITY INSUFFICIENT"
    assert len(result.reasons) > 0


def test_market_context_analysis_valid_chart(
    engine: MarketContextEngine,
    sample_candles: list[CanonicalCandle],
):
    """Verifies complete market context generation with 7-dimension map and zero buy/sell signals."""
    valid_b64 = create_mock_chart_image(width=600, height=400, add_candles=True)
    req = MarketContextRequest(
        asset="BTC/USDT",
        timeframe="1H",
        image_data=valid_b64,
        has_volume=True,
    )

    res = engine.analyze_context(request=req, candles=sample_candles)

    assert res.asset == "BTC/USDT"
    assert res.timeframe == "1H"
    assert res.quality_gate.quality_gate_passed is True
    assert res.evidence_quality in (EvidenceQuality.HIGH, EvidenceQuality.MODERATE)

    # Market map must cover all 7 dimensions
    assert res.market_map.price != ""
    assert res.market_map.structure != ""
    assert res.market_map.time != ""
    assert res.market_map.volume != ""
    assert res.market_map.range != ""
    assert res.market_map.location != ""
    assert res.market_map.candle_behavior != ""

    # Market state
    assert res.market_state.state in [
        MarketContextState.TRENDING,
        MarketContextState.RANGING,
        MarketContextState.COMPRESSING,
        MarketContextState.EXPANDING,
        MarketContextState.TRANSITIONING,
        MarketContextState.REJECTING,
        MarketContextState.CONSOLIDATING,
        MarketContextState.MIXED_UNCLEAR,
    ]

    # Supporting and Conflicting evidence
    assert len(res.supporting_evidence) >= 2
    assert len(res.conflicting_evidence) >= 1

    # What to Watch must be context change conditions, strictly non-signals
    assert len(res.what_to_watch) >= 2
    full_text = " ".join(res.what_to_watch + [res.current_context]).lower()
    for forbidden in ["buy now", "sell now", "go long", "go short", "take profit", "guaranteed"]:
        assert forbidden not in full_text


def test_multi_timeframe_synthesis(
    engine: MarketContextEngine,
    sample_candles: list[CanonicalCandle],
):
    """Verifies hierarchical multi-timeframe synthesis."""
    img_1h = create_mock_chart_image(width=600, height=400, add_candles=True)
    img_4h = create_mock_chart_image(width=600, height=400, add_candles=True)

    req = MarketContextRequest(
        asset="BTC/USDT",
        timeframe="1H",
        image_data=img_1h,
        secondary_screenshots=[
            TimeframeScreenshot(timeframe="4H", image_data=img_4h)
        ],
    )

    res = engine.analyze_context(request=req, candles=sample_candles)
    assert res.multi_timeframe_levels is not None
    assert len(res.multi_timeframe_levels) >= 2
    assert res.multi_timeframe_synthesis is not None
