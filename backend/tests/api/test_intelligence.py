"""API integration tests for Market State / Regime Intelligence endpoints."""

import pytest
from httpx import AsyncClient

from app.schemas.market_state import MarketState


@pytest.mark.asyncio
async def test_get_market_state_success(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/intelligence/BTC/state returns standard envelope with regime classification."""
    response = await async_client.get("/api/v1/intelligence/BTC/state")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert "data" in body
    data = body["data"]

    # Asset & Regime verification
    assert data["symbol"] == "BTC"
    assert "state" in data
    assert data["state"] in [s.value for s in MarketState]

    # Confidence strictly bounded [0.05, 0.95]
    assert 0.05 <= data["confidence"] <= 0.95

    # Rationale and conflict metrics
    assert isinstance(data["primary_rationale"], str)
    assert len(data["primary_rationale"]) > 0
    assert isinstance(data["conflict_detected"], bool)
    assert 0.0 <= data["conflict_score"] <= 1.0

    # Evidence and scores
    assert isinstance(data["evidence"], list)
    assert len(data["evidence"]) > 0
    assert isinstance(data["state_scores"], dict)
    assert len(data["state_scores"]) == 8

    # Metadata & envelope consistency
    assert body["metadata"]["symbol"] == "BTC"
    assert "request_id" in body["metadata"]
    assert body["metadata"]["state"] == data["state"]


@pytest.mark.asyncio
async def test_get_market_state_custom_parameters(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/intelligence/ETH/state accepts custom timeframe and limit."""
    response = await async_client.get("/api/v1/intelligence/ETH/state?timeframe=4h&limit=50")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    data = body["data"]
    assert data["symbol"] == "ETH"
    assert data["timeframe"] == "4h"
    assert data["warmup_periods_used"] == 50


@pytest.mark.asyncio
async def test_get_market_state_not_found(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/intelligence/INVALID/state returns standard 404 error envelope."""
    response = await async_client.get("/api/v1/intelligence/UNKNOWN_CRYPTO_TOKEN/state")
    assert response.status_code == 404
    body = response.json()

    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_get_market_state_invalid_limit_validation(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/intelligence/BTC/state with limit < 5 returns 422 Unprocessable Entity."""
    response = await async_client.get("/api/v1/intelligence/BTC/state?limit=2")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_market_state_request_id_preserved(async_client: AsyncClient) -> None:
    """Verify custom X-Request-ID is preserved in response metadata."""
    custom_id = "test-intel-trace-999"
    response = await async_client.get(
        "/api/v1/intelligence/SOL/state",
        headers={"X-Request-ID": custom_id},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["request_id"] == custom_id
