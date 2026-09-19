"""API integration tests for portfolio management and read-only public wallet tracking."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_portfolio_creates_default(async_client: AsyncClient) -> None:
    """Verify authenticated user can fetch/create core portfolio."""
    # First login to get access token
    login_res = await async_client.post("/api/v1/auth/register", json={
        "email": "portfolio_tester@ghost.io",
        "password": "Password12345!"
    })
    token = login_res.json()["data"]["id"] # user registered

    # Login to acquire bearer token
    token_res = await async_client.post("/api/v1/auth/login", json={
        "username": "portfolio_tester@ghost.io",
        "password": "Password12345!"
    })
    access_token = token_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Fetch portfolio
    res = await async_client.get("/api/v1/portfolio/me", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["name"] == "Core Portfolio"
    assert "assets" in data
    assert "wallets" in data


@pytest.mark.asyncio
async def test_add_and_remove_manual_asset(async_client: AsyncClient) -> None:
    """Verify adding and removing manual asset holdings."""
    # Register & Login
    await async_client.post("/api/v1/auth/register", json={
        "email": "manual_tester@ghost.io",
        "password": "Password12345!"
    })
    token_res = await async_client.post("/api/v1/auth/login", json={
        "username": "manual_tester@ghost.io",
        "password": "Password12345!"
    })
    access_token = token_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Add asset
    add_res = await async_client.post("/api/v1/portfolio/assets", json={
        "symbol": "BTC",
        "quantity": 0.25,
        "avg_entry_price": 60000.0,
        "network": "Bitcoin"
    }, headers=headers)
    assert add_res.status_code == 201
    asset_data = add_res.json()["data"]
    assert asset_data["symbol"] == "BTC"
    assert asset_data["quantity"] == 0.25
    assert asset_data["source"] == "Manual"

    # Remove asset
    asset_id = asset_data["id"]
    del_res = await async_client.delete(f"/api/v1/portfolio/assets/{asset_id}", headers=headers)
    assert del_res.status_code == 200
