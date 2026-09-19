"""Deterministic mock market data provider for testing and offline development."""

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.core.exceptions import NotFoundException
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
from app.services.market_data.base import MarketDataProvider

# Seed configurations for deterministic simulation
ASSET_BASE_PARAMS: Dict[str, Dict[str, Any]] = {
    "BTC": {
        "name": "Bitcoin",
        "base_price": 65000.0,
        "daily_volatility": 0.025,
        "volume_24h": 28500.0,
        "market_cap": 1280000000000.0,
        "min_order": 0.0001,
        "decimals": 2,
    },
    "ETH": {
        "name": "Ethereum",
        "base_price": 3450.0,
        "daily_volatility": 0.035,
        "volume_24h": 142000.0,
        "market_cap": 415000000000.0,
        "min_order": 0.001,
        "decimals": 2,
    },
    "SOL": {
        "name": "Solana",
        "base_price": 145.0,
        "daily_volatility": 0.050,
        "volume_24h": 1250000.0,
        "market_cap": 68000000000.0,
        "min_order": 0.01,
        "decimals": 2,
    },
    "AVAX": {
        "name": "Avalanche",
        "base_price": 32.5,
        "daily_volatility": 0.055,
        "volume_24h": 3200000.0,
        "market_cap": 12500000000.0,
        "min_order": 0.1,
        "decimals": 2,
    },
    "LINK": {
        "name": "Chainlink",
        "base_price": 16.8,
        "daily_volatility": 0.045,
        "volume_24h": 4100000.0,
        "market_cap": 10200000000.0,
        "min_order": 0.1,
        "decimals": 2,
    },
}


class MockMarketDataProvider(MarketDataProvider):
    """Deterministic, provider-agnostic mock market data simulator."""

    name: str = "mock"

    def _normalize_symbol(self, symbol: str) -> str:
        sym = symbol.upper().replace("USDT", "").replace("-USD", "").replace("-", "").replace("/", "").strip()
        if sym not in ASSET_BASE_PARAMS:
            raise NotFoundException(f"Asset '{symbol}' is not supported by the mock market provider.")
        return sym

    def _compute_price(self, symbol: str, timestamp: datetime) -> float:
        """Generates deterministic harmonic price oscillation."""
        params = ASSET_BASE_PARAMS[symbol]
        t = timestamp.timestamp()
        # Combination of slow macro wave and fast diurnal wave
        wave1 = math.sin(t / 86400.0) * params["daily_volatility"] * 0.8
        wave2 = math.cos(t / 14400.0) * params["daily_volatility"] * 0.4
        price = params["base_price"] * (1.0 + wave1 + wave2)
        return round(max(price, 0.01), params["decimals"])

    async def get_current_price(self, symbol: str) -> CanonicalPrice:
        sym = self._normalize_symbol(symbol)
        now = datetime.now(timezone.utc)
        price = self._compute_price(sym, now)
        return CanonicalPrice(symbol=sym, price=price, currency="USD", timestamp=now)

    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> List[CanonicalCandle]:
        sym = self._normalize_symbol(symbol)
        tf_seconds = 3600
        if timeframe.endswith("m"):
            tf_seconds = int(timeframe[:-1]) * 60
        elif timeframe.endswith("h"):
            tf_seconds = int(timeframe[:-1]) * 3600
        elif timeframe.endswith("d"):
            tf_seconds = int(timeframe[:-1]) * 86400

        end_time = end or datetime.now(timezone.utc)
        candles: List[CanonicalCandle] = []

        params = ASSET_BASE_PARAMS[sym]
        volatility = params["daily_volatility"]

        for i in range(limit - 1, -1, -1):
            c_time = end_time - timedelta(seconds=i * tf_seconds)
            if start and c_time < start:
                continue

            open_price = self._compute_price(sym, c_time)
            # deterministic intra-candle drift
            t_int = int(c_time.timestamp())
            delta = math.sin(t_int % 1000) * volatility * open_price * 0.3
            close_price = round(open_price + delta, params["decimals"])

            high_delta = abs(math.cos(t_int % 500)) * volatility * open_price * 0.5
            low_delta = abs(math.sin(t_int % 700)) * volatility * open_price * 0.5

            high_price = round(max(open_price, close_price) + high_delta, params["decimals"])
            low_price = round(min(open_price, close_price) - low_delta, params["decimals"])
            low_price = max(low_price, 0.01)

            volume = round(params["volume_24h"] / (86400.0 / tf_seconds) * (0.8 + 0.4 * abs(math.sin(t_int))), 2)
            trades_count = int(volume * 5)

            candles.append(
                CanonicalCandle(
                    symbol=sym,
                    timeframe=timeframe,
                    timestamp=c_time,
                    open=open_price,
                    high=high_price,
                    low=low_price,
                    close=close_price,
                    volume=volume,
                    trades_count=trades_count,
                )
            )

        return candles

    async def get_orderbook(self, symbol: str, depth: int = 20) -> CanonicalOrderBook:
        sym = self._normalize_symbol(symbol)
        now = datetime.now(timezone.utc)
        curr_price = self._compute_price(sym, now)

        bids: List[OrderBookLevel] = []
        asks: List[OrderBookLevel] = []
        tick_size = curr_price * 0.0002

        for i in range(1, depth + 1):
            bid_p = round(curr_price - i * tick_size, 2)
            ask_p = round(curr_price + i * tick_size, 2)
            qty = round((depth - i + 1) * 1.5 * (1.0 + abs(math.sin(i))), 3)

            bids.append(OrderBookLevel(price=bid_p, quantity=qty))
            asks.append(OrderBookLevel(price=ask_p, quantity=qty))

        spread = round(asks[0].price - bids[0].price, 4) if bids and asks else 0.0
        bid_depth = round(sum(b.quantity for b in bids), 3)
        ask_depth = round(sum(a.quantity for a in asks), 3)

        return CanonicalOrderBook(
            symbol=sym,
            timestamp=now,
            bids=bids,
            asks=asks,
            spread=spread,
            bid_depth=bid_depth,
            ask_depth=ask_depth,
        )

    async def get_volume(self, symbol: str) -> CanonicalVolume:
        sym = self._normalize_symbol(symbol)
        now = datetime.now(timezone.utc)
        curr_price = self._compute_price(sym, now)
        params = ASSET_BASE_PARAMS[sym]

        vol_24h = params["volume_24h"]
        vol_usd = vol_24h * curr_price
        change_24h = round(math.sin(now.timestamp() / 86400.0) * 4.5, 2)

        return CanonicalVolume(
            symbol=sym,
            volume_24h=vol_24h,
            volume_usd_24h=vol_usd,
            change_24h=change_24h,
            timestamp=now,
        )

    async def get_market_overview(self) -> CanonicalMarketOverview:
        now = datetime.now(timezone.utc)
        items: List[CanonicalMarketOverviewItem] = []
        total_mc = 0.0
        total_vol = 0.0

        for sym, params in ASSET_BASE_PARAMS.items():
            curr_price = self._compute_price(sym, now)
            chg = round(math.sin(now.timestamp() / 86400.0 + hash(sym) % 10) * 3.8, 2)
            vol_usd = params["volume_24h"] * curr_price
            mc = params["market_cap"]

            total_mc += mc
            total_vol += vol_usd

            items.append(
                CanonicalMarketOverviewItem(
                    symbol=sym,
                    price=curr_price,
                    change_24h=chg,
                    volume_24h=params["volume_24h"],
                    high_24h=round(curr_price * 1.03, 2),
                    low_24h=round(curr_price * 0.97, 2),
                    market_cap=mc,
                    liquidity_score=0.92 if sym in ("BTC", "ETH") else 0.78,
                    timestamp=now,
                )
            )

        return CanonicalMarketOverview(
            items=items,
            total_market_cap=round(total_mc, 2),
            total_volume_24h=round(total_vol, 2),
            timestamp=now,
        )

    async def get_asset_metadata(self, symbol: str) -> CanonicalAssetMetadata:
        sym = self._normalize_symbol(symbol)
        params = ASSET_BASE_PARAMS[sym]
        return CanonicalAssetMetadata(
            symbol=sym,
            name=params["name"],
            asset_class="crypto",
            base_currency=sym,
            quote_currency="USD",
            min_order_size=params["min_order"],
            price_decimals=params["decimals"],
            is_active=True,
        )

    async def check_health(self) -> Dict[str, Any]:
        return {
            "status": "healthy",
            "provider": self.name,
            "monitored_assets": list(ASSET_BASE_PARAMS.keys()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
