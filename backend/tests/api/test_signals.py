"""API integration tests for Quantitative Signal Engine endpoints."""

import pytest
from httpx import AsyncClient

from app.schemas.signals import SignalDirection


@pytest.mark.asyncio
async def test_get_asset_signal_success(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/signals/BTC returns standard envelope with consensus signal."""
    response = await async_client.get("/api/v1/signals/BTC")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert "data" in body
    data = body["data"]

    # Asset & Direction verification
    assert data["asset"] == "BTC"
    assert data["direction"] in [d.value for d in SignalDirection]

    # Confidence and strength bounds
    assert 0.05 <= data["confidence"] <= 0.95
    assert 0.0 <= data["strength"] <= 1.0

    # Explainability: individual strategy signals preserved
    assert "strategy_signals" in data
    assert len(data["strategy_signals"]) == 5
    strategy_names = [s["strategy_name"] for s in data["strategy_signals"]]
    assert "TechnicalStrategy" in strategy_names
    assert "MomentumStrategy" in strategy_names
    assert "MeanReversionStrategy" in strategy_names
    assert "VolatilityStrategy" in strategy_names
    assert "MultiFactorMLStrategy" in strategy_names

    # Consensus metrics & metadata
    assert "consensus_metrics" in data
    assert data["consensus_metrics"]["strategies_evaluated"] == 5
    assert body["metadata"]["symbol"] == "BTC"
    assert "request_id" in body["metadata"]
    assert body["metadata"]["direction"] == data["direction"]


@pytest.mark.asyncio
async def test_get_asset_signal_custom_timeframe(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/signals/ETH accepts custom timeframe and limit."""
    response = await async_client.get("/api/v1/signals/ETH?timeframe=4h&limit=50")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    data = body["data"]
    assert data["asset"] == "ETH"
    assert data["timeframe"] == "4h"


@pytest.mark.asyncio
async def test_get_asset_signal_not_found(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/signals/UNKNOWN returns standard 404 error envelope."""
    response = await async_client.get("/api/v1/signals/NON_EXISTENT_TOKEN_XYZ")
    assert response.status_code == 404
    body = response.json()

    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_get_asset_signal_validation_limit(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/signals/BTC?limit=2 returns 422 error."""
    response = await async_client.get("/api/v1/signals/BTC?limit=2")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_signal_history_endpoint(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/signals/{symbol}/history returns persisted signal logs."""
    # First generate a live signal to ensure at least one is recorded
    gen_response = await async_client.get("/api/v1/signals/SOL")
    assert gen_response.status_code == 200

    # Now retrieve signal history
    hist_response = await async_client.get("/api/v1/signals/SOL/history?limit=10")
    assert hist_response.status_code == 200
    body = hist_response.json()

    assert body["success"] is True
    assert isinstance(body["data"], list)
    assert len(body["data"]) >= 1
    item = body["data"][0]
    assert item["symbol"] == "SOL"
    assert item["direction"] in [d.value for d in SignalDirection]
    assert 0.05 <= item["confidence"] <= 0.95
    assert "timestamp" in item


@pytest.mark.asyncio
async def test_get_asset_signal_request_id_forwarded(async_client: AsyncClient) -> None:
    """Verify custom X-Request-ID header is forwarded in metadata."""
    custom_id = "trace-sig-req-444"
    response = await async_client.get(
        "/api/v1/signals/AVAX",
        headers={"X-Request-ID": custom_id},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["request_id"] == custom_id
