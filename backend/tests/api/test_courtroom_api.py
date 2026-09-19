"""API integration tests for Courtroom adversarial market reasoning endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_courtroom_create_and_retrieve_case(async_client: AsyncClient) -> None:
    """Verifies POST /api/v1/courtroom/cases creates a valid case and GET /cases/{id} retrieves it."""
    payload = {
        "symbol": "BTCUSDT",
        "timeframe": "4h",
        "thesis": "I think BTC is bullish and will continue its upward trend.",
        "support_level": 80000.0,
        "resistance_level": 85000.0,
    }

    # 1. Create Case
    response = await async_client.post("/api/v1/courtroom/cases", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    data = body["data"]

    case_id = data["case_id"]
    assert case_id.startswith("CASE-GHOST-")
    assert data["symbol"] == "BTCUSDT"
    assert data["timeframe"] == "4h"
    assert data["detected_stance"] == "BULLISH"
    assert data["status"] == "IN_SESSION"
    assert len(data["prosecution_arguments"]) > 0
    assert len(data["defense_arguments"]) > 0
    assert len(data["cross_examination"]) > 0
    assert len(data["invalidation_conditions"]) > 0
    assert data["verdict"] in [
        "SUPPORTED",
        "PARTIALLY SUPPORTED",
        "WEAKENED",
        "CONTRADICTED",
        "INCONCLUSIVE",
        "NO CLEAR VERDICT",
    ]

    # 2. Retrieve Case by ID
    get_res = await async_client.get(f"/api/v1/courtroom/cases/{case_id}")
    assert get_res.status_code == 200
    retrieved = get_res.json()["data"]
    assert retrieved["case_id"] == case_id
    assert retrieved["symbol"] == "BTCUSDT"

    # 3. List Cases
    list_res = await async_client.get("/api/v1/courtroom/cases?limit=10")
    assert list_res.status_code == 200
    cases_list = list_res.json()["data"]
    assert any(c["case_id"] == case_id for c in cases_list)


@pytest.mark.asyncio
async def test_courtroom_case_not_found(async_client: AsyncClient) -> None:
    """Verifies GET /api/v1/courtroom/cases/{case_id} returns 404 for non-existent case."""
    response = await async_client.get("/api/v1/courtroom/cases/CASE-GHOST-999999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_courtroom_invalid_timeframe(async_client: AsyncClient) -> None:
    """Verifies that invalid timeframe is rejected with 422 or 400 validation error."""
    payload = {
        "symbol": "BTCUSDT",
        "timeframe": "invalid_timeframe",
        "thesis": "Bitcoin is bullish",
    }
    response = await async_client.post("/api/v1/courtroom/cases", json=payload)
    assert response.status_code in (400, 422)
