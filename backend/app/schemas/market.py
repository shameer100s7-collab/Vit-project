"""Canonical market data schemas for cross-provider normalization."""

from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class OrderBookLevel(BaseModel):
    """Normalized price and volume level in an orderbook."""
    price: float = Field(..., ge=0.0, description="Price level")
    quantity: float = Field(..., ge=0.0, description="Volume/quantity available at price level")


class CanonicalPrice(BaseModel):
    """Normalized real-time asset price."""
    symbol: str = Field(..., description="Canonical ticker symbol (e.g. BTC, ETH)")
    price: float = Field(..., gt=0.0, description="Current price in quote currency")
    currency: str = Field(default="USD", description="Quote currency")
    source: str = Field(default="Binance Spot", description="Authoritative market data source")
    bid_price: Optional[float] = Field(default=None, description="Current best bid price")
    ask_price: Optional[float] = Field(default=None, description="Current best ask price")
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
    quote_volume: Optional[float] = Field(default=None, ge=0.0, description="Total quote turnover volume")
    trades_count: Optional[int] = Field(default=None, description="Number of executed trades during interval")
    close_time: Optional[datetime] = Field(default=None, description="Closing timestamp of candle interval")
    source: str = Field(default="Binance Spot", description="Authoritative market data source")


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
    spread_pct: Optional[float] = Field(default=None, description="Bid-ask spread percentage")
    bid_depth: float = Field(default=0.0, ge=0.0, description="Aggregated bid liquidity")
    ask_depth: float = Field(default=0.0, ge=0.0, description="Aggregated ask liquidity")
    last_update_id: Optional[int] = Field(default=None, description="Provider sequence or event update ID")
    source: str = Field(default="Binance Spot", description="Authoritative market data source")


class CanonicalVolume(BaseModel):
    """Normalized volume and 24-hour market statistics."""
    symbol: str = Field(..., description="Canonical ticker symbol")
    volume_24h: float = Field(..., ge=0.0, description="Total 24h base asset volume")
    volume_usd_24h: Optional[float] = Field(default=None, ge=0.0, description="Total 24h volume in USD/quote")
    quote_volume_24h: Optional[float] = Field(default=None, ge=0.0, description="Total 24h quote volume")
    change_24h: Optional[float] = Field(default=None, description="24h price percentage change")
    price_change_pct_24h: Optional[float] = Field(default=None, description="24h price percentage change")
    price_change_24h: Optional[float] = Field(default=None, description="24h absolute price change")
    high_24h: Optional[float] = Field(default=None, description="24h high price")
    low_24h: Optional[float] = Field(default=None, description="24h low price")
    open_price_24h: Optional[float] = Field(default=None, description="24h open price")
    last_price: Optional[float] = Field(default=None, description="Last trade price")
    trades_count_24h: Optional[int] = Field(default=None, description="Total trades count in last 24h")
    bid_price: Optional[float] = Field(default=None, description="Top-of-book bid price")
    ask_price: Optional[float] = Field(default=None, description="Top-of-book ask price")
    source: str = Field(default="Binance Spot", description="Authoritative market data source")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of observation",
    )

    @model_validator(mode="before")
    @classmethod
    def sync_aliases(cls, data: any) -> any:
        if isinstance(data, dict):
            # Sync volume_usd_24h <-> quote_volume_24h
            if "quote_volume_24h" in data and "volume_usd_24h" not in data:
                data["volume_usd_24h"] = data["quote_volume_24h"]
            elif "volume_usd_24h" in data and "quote_volume_24h" not in data:
                data["quote_volume_24h"] = data["volume_usd_24h"]
            # Sync change_24h <-> price_change_pct_24h
            if "price_change_pct_24h" in data and "change_24h" not in data:
                data["change_24h"] = data["price_change_pct_24h"]
            elif "change_24h" in data and "price_change_pct_24h" not in data:
                data["price_change_pct_24h"] = data["change_24h"]
        return data


class CanonicalAssetMetadata(BaseModel):
    """Normalized asset static and execution metadata."""
    symbol: str = Field(..., description="Canonical asset symbol")
    name: str = Field(..., description="Asset name (e.g. Bitcoin)")
    asset_class: str = Field(default="crypto", description="Asset class classification")
    base_currency: str = Field(..., description="Base currency symbol")
    quote_currency: str = Field(default="USD", description="Quote currency symbol")
    base_asset: Optional[str] = Field(default=None, description="Base asset ticker")
    quote_asset: Optional[str] = Field(default=None, description="Quote asset ticker")
    min_order_size: float = Field(default=0.0001, description="Minimum allowable order size")
    min_order_quantity: Optional[float] = Field(default=None, description="Minimum allowable order quantity")
    price_decimals: int = Field(default=2, description="Price precision decimals")
    price_precision: Optional[int] = Field(default=None, description="Price precision decimals")
    is_active: bool = Field(default=True, description="Whether asset is active for intelligence analysis")

    @model_validator(mode="before")
    @classmethod
    def sync_metadata_aliases(cls, data: any) -> any:
        if isinstance(data, dict):
            if "base_asset" not in data and "base_currency" in data:
                data["base_asset"] = data["base_currency"]
            elif "base_currency" not in data and "base_asset" in data:
                data["base_currency"] = data["base_asset"]
            if "quote_asset" not in data and "quote_currency" in data:
                data["quote_asset"] = data["quote_currency"]
            elif "quote_currency" not in data and "quote_asset" in data:
                data["quote_currency"] = data["quote_asset"]
            if "min_order_quantity" not in data and "min_order_size" in data:
                data["min_order_quantity"] = data["min_order_size"]
            elif "min_order_size" not in data and "min_order_quantity" in data:
                data["min_order_size"] = data["min_order_quantity"]
            if "price_precision" not in data and "price_decimals" in data:
                data["price_precision"] = data["price_decimals"]
            elif "price_decimals" not in data and "price_precision" in data:
                data["price_decimals"] = data["price_precision"]
        return data


class TradableSymbolItem(BaseModel):
    """Normalized tradable symbol specifications discovered from exchange."""
    symbol: str = Field(..., description="Canonical exchange symbol (e.g. BTCUSDT)")
    display_symbol: str = Field(..., description="Human readable display symbol (e.g. BTC/USDT)")
    base_asset: str = Field(..., description="Base asset currency (e.g. BTC)")
    quote_asset: str = Field(..., description="Quote asset currency (e.g. USDT)")
    status: str = Field(default="TRADING", description="Trading status on exchange")
    price_precision: int = Field(default=2, description="Price decimal precision")
    quantity_precision: int = Field(default=4, description="Quantity decimal precision")
    min_order_quantity: float = Field(default=0.0001, description="Minimum order quantity")
    is_active: bool = Field(default=True, description="Whether symbol is active")


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
    source: str = Field(default="Binance Spot", description="Authoritative market data source")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of summary",
    )


class CanonicalMarketOverview(BaseModel):
    """Aggregated market overview payload."""
    items: List[CanonicalMarketOverviewItem] = Field(..., description="List of monitored asset overviews")
    total_market_cap: Optional[float] = Field(default=None, description="Total crypto market cap estimate")
    total_volume_24h: Optional[float] = Field(default=None, description="Total aggregate 24h volume estimate")
    source: str = Field(default="Binance Spot", description="Authoritative market data source")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of aggregate overview",
    )
