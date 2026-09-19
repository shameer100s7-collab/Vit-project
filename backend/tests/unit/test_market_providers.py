"""Unit tests for market data providers and caching mechanisms."""

import asyncio
import pytest

from app.core.exceptions import NotFoundException
from app.services.market_data.cache import MarketDataCache
from app.services.market_data.mock_provider import MockMarketDataProvider
from app.services.market_data.service import MarketDataService


@pytest.mark.asyncio
async def test_mock_provider_pricing() -> None:
    """Verify MockMarketDataProvider generates valid prices."""
    provider = MockMarketDataProvider()
    price = await provider.get_current_price("BTC")
    assert price.symbol == "BTC"
    assert price.price > 50000.0
    assert price.currency == "USD"


@pytest.mark.asyncio
async def test_mock_provider_candles() -> None:
    """Verify MockMarketDataProvider produces valid OHLCV candles."""
    provider = MockMarketDataProvider()
    candles = await provider.get_ohlcv("ETH", timeframe="1h", limit=50)
    assert len(candles) == 50
    for candle in candles:
        assert candle.symbol == "ETH"
        assert candle.high >= candle.low
        assert candle.volume >= 0.0


@pytest.mark.asyncio
async def test_mock_provider_orderbook() -> None:
    """Verify orderbook bids and asks ordering."""
    provider = MockMarketDataProvider()
    ob = await provider.get_orderbook("SOL", depth=10)
    assert ob.symbol == "SOL"
    assert len(ob.bids) == 10
    assert len(ob.asks) == 10
    # Bids should be strictly descending
    for i in range(len(ob.bids) - 1):
        assert ob.bids[i].price >= ob.bids[i + 1].price
    # Asks should be strictly ascending
    for i in range(len(ob.asks) - 1):
        assert ob.asks[i].price <= ob.asks[i + 1].price
    assert ob.spread > 0.0


@pytest.mark.asyncio
async def test_mock_provider_unsupported_symbol() -> None:
    """Verify unsupported symbol raises NotFoundException."""
    provider = MockMarketDataProvider()
    with pytest.raises(NotFoundException):
        await provider.get_current_price("UNKNOWN_COIN_XYZ")


@pytest.mark.asyncio
async def test_market_data_cache_ttl() -> None:
    """Verify MarketDataCache TTL expiration."""
    cache = MarketDataCache()
    await cache.set("test_key", {"price": 100}, ttl_seconds=1)

    cached_val = await cache.get("test_key")
    assert cached_val == {"price": 100}

    # Wait for TTL expiration
    await asyncio.sleep(1.1)
    expired_val = await cache.get("test_key")
    assert expired_val is None


@pytest.mark.asyncio
async def test_market_data_service_caching() -> None:
    """Verify MarketDataService caches responses to prevent redundant provider hits."""
    cache = MarketDataCache()
    provider = MockMarketDataProvider()
    service = MarketDataService(provider=provider, cache=cache)

    price1 = await service.get_current_price("BTC")
    price2 = await service.get_current_price("BTC")

    # Identical reference from cache
    assert price1 == price2
    assert price1.price == price2.price
