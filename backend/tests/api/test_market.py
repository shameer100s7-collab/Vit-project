"""API integration tests for market data endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_market_overview(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/market/overview returns standard envelope with asset summaries."""
    response = await async_client.get("/api/v1/market/overview")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert "data" in body
    data = body["data"]
    assert "items" in data
    assert len(data["items"]) >= 3
    symbols = [item["symbol"] for item in data["items"]]
    assert "BTC" in symbols
    assert "ETH" in symbols


@pytest.mark.asyncio
async def test_get_asset_price_success(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/market/BTC returns normalized price."""
    response = await async_client.get("/api/v1/market/BTC")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    data = body["data"]
    assert data["symbol"] == "BTC"
    assert data["price"] > 0.0
    assert data["currency"] == "USD"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_get_asset_price_not_found(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/market/INVALID returns 404 Not Found error envelope."""
    response = await async_client.get("/api/v1/market/INVALID_TICKER_99")
    assert response.status_code == 404
    body = response.json()

    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_get_asset_ohlcv(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/market/ETH/ohlcv returns requested number of candles."""
    response = await async_client.get("/api/v1/market/ETH/ohlcv?timeframe=1h&limit=30")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    candles = body["data"]
    assert len(candles) == 30
    assert body["metadata"]["count"] == 30
    assert body["metadata"]["timeframe"] == "1h"

    first_candle = candles[0]
    assert first_candle["symbol"] == "ETH"
    assert first_candle["high"] >= first_candle["low"]


@pytest.mark.asyncio
async def test_get_asset_orderbook(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/market/SOL/orderbook returns depth and spread."""
    response = await async_client.get("/api/v1/market/SOL/orderbook?depth=12")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    ob = body["data"]
    assert ob["symbol"] == "SOL"
    assert len(ob["bids"]) == 12
    assert len(ob["asks"]) == 12
    assert ob["spread"] > 0.0


@pytest.mark.asyncio
async def test_get_asset_volume(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/market/AVAX/volume returns 24h volume metrics."""
    response = await async_client.get("/api/v1/market/AVAX/volume")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    data = body["data"]
    assert data["symbol"] == "AVAX"
    assert data["volume_24h"] > 0.0


@pytest.mark.asyncio
async def test_get_asset_metadata(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/market/BTC/metadata returns static parameters."""
    response = await async_client.get("/api/v1/market/BTC/metadata")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    data = body["data"]
    assert data["symbol"] == "BTC"
    assert data["name"] == "Bitcoin"
    assert data["asset_class"] == "crypto"
    assert data["base_currency"] == "BTC"
    assert data["quote_currency"] in ("USD", "USDT")


@pytest.mark.asyncio
async def test_get_tradable_symbols(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/market/symbols returns discovered active trading symbols."""
    response = await async_client.get("/api/v1/market/symbols")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert "data" in body
    assert len(body["data"]) > 0
    symbols = [s["symbol"] for s in body["data"]]
    assert "BTCUSDT" in symbols


@pytest.mark.asyncio
async def test_get_provider_health(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/market/provider/health reports healthy provider status."""
    response = await async_client.get("/api/v1/market/provider/health")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert body["data"]["status"] == "healthy"
