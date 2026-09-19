"""API integration tests for Observable Behavior Model endpoints."""

import pytest
from httpx import AsyncClient

from app.schemas.behavior import BehaviorState, ParticipantArchetype


@pytest.mark.asyncio
async def test_get_asset_behavior_success(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/behavior/BTC returns standard envelope with participant analysis."""
    response = await async_client.get("/api/v1/behavior/BTC")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert "data" in body
    data = body["data"]

    # Asset & State verification
    assert data["symbol"] == "BTC"
    assert data["behavior_state"] in [s.value for s in BehaviorState]
    assert data["primary_participant"] in [p.value for p in ParticipantArchetype]

    # Bounded confidence
    assert 0.05 <= data["confidence"] <= 0.95

    # Separation: Factual observations vs Inferred breakdown
    assert "observations" in data
    assert len(data["observations"]) > 0
    obs_0 = data["observations"][0]
    assert "metric" in obs_0
    assert "value" in obs_0
    assert "source" in obs_0
    assert "interpretation" in obs_0

    # Liquidity pressure & Whale indicators
    assert "liquidity_pressure" in data
    assert -1.0 <= data["liquidity_pressure"]["net_imbalance"] <= 1.0
    assert "whale_activity" in data
    assert isinstance(data["whale_activity"]["wall_detected"], bool)

    # Participant probabilities
    assert "participant_breakdown" in data
    assert len(data["participant_breakdown"]) == 7

    # Metadata & envelope consistency
    assert body["metadata"]["symbol"] == "BTC"
    assert "request_id" in body["metadata"]
    assert body["metadata"]["behavior_state"] == data["behavior_state"]


@pytest.mark.asyncio
async def test_get_asset_behavior_custom_parameters(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/behavior/ETH accepts custom timeframe and limit."""
    response = await async_client.get("/api/v1/behavior/ETH?timeframe=4h&limit=50")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    data = body["data"]
    assert data["symbol"] == "ETH"
    assert data["timeframe"] == "4h"


@pytest.mark.asyncio
async def test_get_asset_behavior_not_found(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/behavior/INVALID returns standard 404 error envelope."""
    response = await async_client.get("/api/v1/behavior/UNKNOWN_COIN_XYZ_999")
    assert response.status_code == 404
    body = response.json()

    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_get_asset_behavior_validation_limit(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/behavior/BTC with limit < 5 returns 422 error."""
    response = await async_client.get("/api/v1/behavior/BTC?limit=2")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_asset_behavior_request_id_forwarded(async_client: AsyncClient) -> None:
    """Verify custom X-Request-ID header is forwarded in metadata."""
    custom_id = "trace-behavior-id-777"
    response = await async_client.get(
        "/api/v1/behavior/SOL",
        headers={"X-Request-ID": custom_id},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["request_id"] == custom_id
