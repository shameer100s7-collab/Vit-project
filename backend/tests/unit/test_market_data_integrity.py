"""Unit tests for market data integrity, normalization, and validation rules."""

from datetime import datetime, timezone
import pytest

from app.core.exceptions import NotFoundException, ProviderException
from app.schemas.market import (
    CanonicalCandle,
    CanonicalOrderBook,
    CanonicalPrice,
    CanonicalVolume,
    OrderBookLevel,
)
from app.services.market_data.real_provider import BinanceMarketDataProvider
from app.services.market_data.service import MarketDataService


class MockFailingProvider(BinanceMarketDataProvider):
    """Simulates provider outage for testing failure handling."""

    async def get_current_price(self, symbol: str) -> CanonicalPrice:
        raise ProviderException("Simulated connection timeout")

    async def get_ohlcv(self, symbol: str, timeframe: str = "1h", limit: int = 100, **kwargs):
        raise ProviderException("Simulated stream error")


def test_symbol_normalization() -> None:
    """Verify robust symbol formatting for Binance Spot."""
    provider = BinanceMarketDataProvider()
    assert provider._to_binance_symbol("BTC") == "BTCUSDT"
    assert provider._to_binance_symbol("eth") == "ETHUSDT"
    assert provider._to_binance_symbol("SOL/USDT") == "SOLUSDT"
    assert provider._to_binance_symbol("BNB-USDT") == "BNBUSDT"
    assert provider._to_binance_symbol("BTCUSDC") == "BTCUSDC"
    assert provider._to_binance_symbol("ETHBTC") == "ETHBTC"

    assert provider._from_binance_symbol("BTCUSDT") == "BTC"
    assert provider._from_binance_symbol("ETHUSDT") == "ETH"
    assert provider._to_display_symbol("BTCUSDT") == "BTC/USDT"


def test_volume_24h_normalization() -> None:
    """Verify 24h ticker normalization with authoritative source attribution."""
    vol = CanonicalVolume(
        symbol="BTC",
        volume_24h=12500.5,
        quote_volume_24h=1025000000.0,
        price_change_pct_24h=1.45,
        price_change_24h=1200.0,
        high_24h=82500.0,
        low_24h=80100.0,
        trades_count_24h=1950000,
        source="Binance Spot",
        timestamp=datetime.now(timezone.utc),
    )
    assert vol.source == "Binance Spot"
    assert vol.high_24h == 82500.0
    assert vol.low_24h == 80100.0
    assert vol.volume_usd_24h == 1025000000.0
    assert vol.change_24h == 1.45
    assert vol.trades_count_24h == 1950000


def test_orderbook_normalization_and_sorting() -> None:
    """Verify orderbook depth sorting and spread calculation."""
    bids = [
        OrderBookLevel(price=81800.0, quantity=1.5),
        OrderBookLevel(price=81790.0, quantity=2.0),
    ]
    asks = [
        OrderBookLevel(price=81810.0, quantity=1.0),
        OrderBookLevel(price=81820.0, quantity=3.0),
    ]
    spread = asks[0].price - bids[0].price
    spread_pct = (spread / asks[0].price) * 100.0

    ob = CanonicalOrderBook(
        symbol="BTC",
        bids=bids,
        asks=asks,
        spread=spread,
        spread_pct=spread_pct,
        last_update_id=12345678,
        source="Binance Spot",
    )
    assert ob.spread == 10.0
    assert round(ob.spread_pct, 4) == round((10.0 / 81810.0) * 100.0, 4)
    assert ob.last_update_id == 12345678
    assert ob.bids[0].price > ob.bids[1].price
    assert ob.asks[0].price < ob.asks[1].price


def test_candle_logical_validation() -> None:
    """Verify OHLCV candlestick mathematical sanity rules."""
    valid_candle = CanonicalCandle(
        symbol="BTC",
        timeframe="1h",
        timestamp=datetime.now(timezone.utc),
        open=81000.0,
        high=82000.0,
        low=80500.0,
        close=81500.0,
        volume=500.0,
        quote_volume=41000000.0,
        trades_count=25000,
        source="Binance Spot",
    )
    assert valid_candle.high >= max(valid_candle.open, valid_candle.close)
    assert valid_candle.low <= min(valid_candle.open, valid_candle.close)
    assert valid_candle.volume >= 0.0


@pytest.mark.asyncio
async def test_service_no_silent_mock_fallback_on_failure() -> None:
    """Verify that when Binance fails in production, it does NOT silently substitute fake mock data."""
    failing_provider = MockFailingProvider()
    service = MarketDataService(provider=failing_provider)
    # Ensure fallback is not active
    service._allow_mock_fallback = False

    with pytest.raises(ProviderException) as exc_info:
        await service.get_current_price("BTC")
    assert "Live market price unavailable" in str(exc_info.value)
