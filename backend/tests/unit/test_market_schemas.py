"""Unit tests for canonical market data schemas and normalization."""

from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from app.schemas.market import (
    CanonicalAssetMetadata,
    CanonicalCandle,
    CanonicalMarketOverview,
    CanonicalMarketOverviewItem,
    CanonicalOrderBook,
    CanonicalPrice,
    CanonicalVolume,
    OrderBookLevel,
)


def test_canonical_price_validation() -> None:
    """Verify CanonicalPrice model constraints."""
    now = datetime.now(timezone.utc)
    price = CanonicalPrice(symbol="BTC", price=64500.50, currency="USD", timestamp=now)
    assert price.symbol == "BTC"
    assert price.price == 64500.50
    assert price.currency == "USD"

    # Price cannot be negative or zero
    with pytest.raises(ValidationError):
        CanonicalPrice(symbol="BTC", price=0.0)


def test_canonical_candle_validation() -> None:
    """Verify CanonicalCandle schema fields."""
    now = datetime.now(timezone.utc)
    candle = CanonicalCandle(
        symbol="ETH",
        timeframe="1h",
        timestamp=now,
        open=3400.0,
        high=3450.0,
        low=3380.0,
        close=3420.0,
        volume=15000.0,
        trades_count=8500,
    )
    assert candle.symbol == "ETH"
    assert candle.high >= candle.low
    assert candle.high >= candle.open
    assert candle.high >= candle.close


def test_canonical_orderbook_metrics() -> None:
    """Verify CanonicalOrderBook structure and spread calculation."""
    bids = [OrderBookLevel(price=100.0, quantity=2.0), OrderBookLevel(price=99.0, quantity=3.0)]
    asks = [OrderBookLevel(price=101.0, quantity=1.5), OrderBookLevel(price=102.0, quantity=4.0)]

    ob = CanonicalOrderBook(
        symbol="SOL",
        bids=bids,
        asks=asks,
        spread=1.0,
        bid_depth=5.0,
        ask_depth=5.5,
    )
    assert ob.symbol == "SOL"
    assert len(ob.bids) == 2
    assert len(ob.asks) == 2
    assert ob.spread == 1.0
    assert ob.bid_depth == 5.0
    assert ob.ask_depth == 5.5


def test_canonical_market_overview() -> None:
    """Verify CanonicalMarketOverview aggregation schema."""
    item = CanonicalMarketOverviewItem(
        symbol="BTC",
        price=65000.0,
        change_24h=2.5,
        volume_24h=25000.0,
        market_cap=1200000000000.0,
    )
    overview = CanonicalMarketOverview(
        items=[item],
        total_market_cap=1200000000000.0,
        total_volume_24h=1625000000.0,
    )
    assert len(overview.items) == 1
    assert overview.items[0].symbol == "BTC"
