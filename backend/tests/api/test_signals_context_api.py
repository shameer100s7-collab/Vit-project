"""API integration tests for Market Context Engine routes."""

import base64
import io
from PIL import Image, ImageDraw
import pytest
from httpx import AsyncClient


def make_test_chart(width: int = 500, height: int = 350) -> str:
    """Generates a valid test chart image."""
    img = Image.new("RGB", (width, height), color=(20, 24, 33))
    draw = ImageDraw.Draw(img)
    for i in range(10):
        draw.line([(50 + i * 30, 80), (50 + i * 30, 220)], fill=(0, 220, 180), width=2)
        draw.rectangle([(45 + i * 30, 100), (55 + i * 30, 180)], fill=(0, 200, 150), outline=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@pytest.mark.asyncio
async def test_analyze_market_context_api_success(async_client: AsyncClient) -> None:
    """Verifies POST /api/v1/signals/context/analyze returns structured 200 envelope."""
    img_b64 = make_test_chart()
    payload = {
        "asset": "BTC/USDT",
        "timeframe": "1H",
        "image_data": img_b64,
        "has_volume": True,
    }

    response = await async_client.post("/api/v1/signals/context/analyze", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True

    data = body["data"]
    assert data["asset"] == "BTC/USDT"
    assert data["timeframe"] == "1H"
    assert data["evidence_quality"] in ("HIGH", "MODERATE", "LIMITED")
    assert "market_state" in data
    assert "market_map" in data
    assert len(data["supporting_evidence"]) > 0
    assert len(data["what_to_watch"]) > 0


@pytest.mark.asyncio
async def test_analyze_market_context_quality_gate_failure(async_client: AsyncClient) -> None:
    """Verifies low-resolution monochromatic image triggers quality gate failure with CHART CLARITY INSUFFICIENT."""
    # Blank 80x80 image
    img = Image.new("RGB", (80, 80), color=(10, 10, 10))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    bad_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    payload = {
        "asset": "ETH/USDT",
        "timeframe": "15M",
        "image_data": bad_b64,
    }

    response = await async_client.post("/api/v1/signals/context/analyze", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()["data"]

    assert data["evidence_quality"] == "INSUFFICIENT"
    assert data["quality_gate"]["quality_gate_passed"] is False
    assert data["quality_gate"]["error_title"] == "CHART CLARITY INSUFFICIENT"


@pytest.mark.asyncio
async def test_legacy_asset_signal_route_preserved(async_client: AsyncClient) -> None:
    """Verifies existing GET /api/v1/signals/{symbol} route remains functional with zero regression."""
    response = await async_client.get("/api/v1/signals/BTC")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert "data" in body
    assert body["data"]["asset"] == "BTC"
