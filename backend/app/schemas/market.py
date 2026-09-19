"""Canonical market data schemas for cross-provider normalization."""

from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


class OrderBookLevel(BaseModel):
    """Normalized price and volume level in an orderbook."""
    price: float = Field(..., ge=0.0, description="Price level")
    quantity: float = Field(..., ge=0.0, description="Volume/quantity available at price level")


class CanonicalPrice(BaseModel):
    """Normalized real-time asset price."""
    symbol: str = Field(..., description="Canonical ticker symbol (e.g. BTC, ETH)")
    price: float = Field(..., gt=0.0, description="Current price in quote currency")
    currency: str = Field(default="USD", description="Quote currency")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of price quotation",
    )


class CanonicalCandle(BaseModel):
    """Normalized OHLCV market candle."""
    symbol: str = Field(..., description="Canonical ticker symbol (e.g. BTC)")
    timeframe: str = Field(..., description="Candle interval (e.g. 1m, 5m, 1h, 1d)")
    timestamp: datetime = Field(..., description="Opening timestamp of candle interval")
    open: float = Field(..., gt=0.0, description="Opening price")
    high: float = Field(..., gt=0.0, description="Highest price during interval")
    low: float = Field(..., gt=0.0, description="Lowest price during interval")
    close: float = Field(..., gt=0.0, description="Closing price")
    volume: float = Field(..., ge=0.0, description="Total traded asset volume")
    trades_count: Optional[int] = Field(default=None, description="Number of executed trades during interval")


class CanonicalOrderBook(BaseModel):
    """Normalized depth of market orderbook."""
    symbol: str = Field(..., description="Canonical ticker symbol")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of orderbook snapshot",
    )
    bids: List[OrderBookLevel] = Field(default_factory=list, description="Sorted bids (highest price first)")
    asks: List[OrderBookLevel] = Field(default_factory=list, description="Sorted asks (lowest price first)")
    spread: float = Field(default=0.0, ge=0.0, description="Bid-ask spread (best ask minus best bid)")
    bid_depth: float = Field(default=0.0, ge=0.0, description="Aggregated bid liquidity")
    ask_depth: float = Field(default=0.0, ge=0.0, description="Aggregated ask liquidity")


class CanonicalVolume(BaseModel):
    """Normalized volume and liquidity metrics."""
    symbol: str = Field(..., description="Canonical ticker symbol")
    volume_24h: float = Field(..., ge=0.0, description="Total 24h asset volume")
    volume_usd_24h: Optional[float] = Field(default=None, ge=0.0, description="Total 24h volume in USD")
    change_24h: Optional[float] = Field(default=None, description="24h price percentage change")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of observation",
    )


class CanonicalAssetMetadata(BaseModel):
    """Normalized asset static and execution metadata."""
    symbol: str = Field(..., description="Canonical asset symbol")
    name: str = Field(..., description="Asset name (e.g. Bitcoin)")
    asset_class: str = Field(default="crypto", description="Asset class classification")
    base_currency: str = Field(..., description="Base currency symbol")
    quote_currency: str = Field(default="USD", description="Quote currency symbol")
    min_order_size: float = Field(default=0.0001, description="Minimum allowable order size")
    price_decimals: int = Field(default=2, description="Price precision decimals")
    is_active: bool = Field(default=True, description="Whether asset is active for intelligence analysis")


class CanonicalMarketOverviewItem(BaseModel):
    """Normalized single asset summary for market overview."""
    symbol: str = Field(..., description="Asset symbol")
    price: float = Field(..., gt=0.0, description="Current price")
    change_24h: float = Field(..., description="24-hour price change percentage")
    volume_24h: float = Field(..., ge=0.0, description="24-hour traded volume")
    high_24h: Optional[float] = Field(default=None, description="24-hour high price")
    low_24h: Optional[float] = Field(default=None, description="24-hour low price")
    market_cap: Optional[float] = Field(default=None, description="Estimated market capitalization")
    liquidity_score: Optional[float] = Field(default=None, description="Normalized liquidity score [0.0 to 1.0]")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of summary",
    )


class CanonicalMarketOverview(BaseModel):
    """Aggregated market overview payload."""
    items: List[CanonicalMarketOverviewItem] = Field(..., description="List of monitored asset overviews")
    total_market_cap: Optional[float] = Field(default=None, description="Total crypto market cap estimate")
    total_volume_24h: Optional[float] = Field(default=None, description="Total aggregate 24h volume estimate")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of aggregate overview",
    )
