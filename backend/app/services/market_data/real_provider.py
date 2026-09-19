"""Binance public REST API market data provider adapter."""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings
from app.core.exceptions import NotFoundException, ProviderException, RateLimitException
from app.core.logging import get_logger
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

logger = get_logger("ghost.market_data.binance")


class BinanceMarketDataProvider(MarketDataProvider):
    """Production public REST market data provider connecting to Binance."""

    name: str = "binance"

    def __init__(self, base_url: Optional[str] = None, timeout: float = 5.0) -> None:
        self.base_url = base_url or settings.BINANCE_API_URL
        self.timeout = timeout

    def _to_binance_symbol(self, symbol: str) -> str:
        sym = symbol.upper().replace("-", "").replace("/", "").strip()
        if not sym.endswith("USDT") and not sym.endswith("BUSD") and not sym.endswith("USD"):
            sym = f"{sym}USDT"
        return sym

    def _from_binance_symbol(self, symbol: str) -> str:
        return symbol.replace("USDT", "").replace("BUSD", "")

    async def _execute_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Executes HTTP request with exponential backoff retries and rate limit protection."""
        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        max_retries = 3
        delay = 0.5

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(url, params=params)

                if response.status_code == 429:
                    logger.warning("Binance rate limit triggered (HTTP 429).")
                    raise RateLimitException("Binance rate limit encountered. Please reduce query frequency.")

                if response.status_code == 400:
                    data = response.json()
                    if data.get("code") == -1121:  # Invalid symbol
                        raise NotFoundException(f"Symbol not recognized by Binance: {params}")
                    raise ProviderException(f"Binance client error: {data.get('msg', 'Bad Request')}")

                if response.status_code >= 500:
                    if attempt == max_retries:
                        raise ProviderException(f"Binance upstream server error: HTTP {response.status_code}")
                    await asyncio.sleep(delay)
                    delay *= 2
                    continue

                response.raise_for_status()
                return response.json()

            except (httpx.ConnectError, httpx.TimeoutException) as exc:
                if attempt == max_retries:
                    logger.error("Binance connection failed after %d attempts: %s", max_retries, exc)
                    raise ProviderException(f"Unable to connect to market provider: {exc}")
                await asyncio.sleep(delay)
                delay *= 2

    async def get_current_price(self, symbol: str) -> CanonicalPrice:
        raw_symbol = self._to_binance_symbol(symbol)
        data = await self._execute_request("/ticker/price", params={"symbol": raw_symbol})
        clean_sym = self._from_binance_symbol(raw_symbol)

        return CanonicalPrice(
            symbol=clean_sym,
            price=float(data["price"]),
            currency="USD",
            timestamp=datetime.now(timezone.utc),
        )

    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> List[CanonicalCandle]:
        raw_symbol = self._to_binance_symbol(symbol)
        clean_sym = self._from_binance_symbol(raw_symbol)

        params: Dict[str, Any] = {
            "symbol": raw_symbol,
            "interval": timeframe,
            "limit": min(limit, 1000),
        }
        if start:
            params["startTime"] = int(start.timestamp() * 1000)
        if end:
            params["endTime"] = int(end.timestamp() * 1000)

        raw_klines = await self._execute_request("/klines", params=params)
        candles: List[CanonicalCandle] = []

        for item in raw_klines:
            # Binance kline format:
            # [0: openTime, 1: open, 2: high, 3: low, 4: close, 5: volume, 6: closeTime, 7: quoteVol, 8: count, ...]
            c_time = datetime.fromtimestamp(item[0] / 1000.0, tz=timezone.utc)
            candles.append(
                CanonicalCandle(
                    symbol=clean_sym,
                    timeframe=timeframe,
                    timestamp=c_time,
                    open=float(item[1]),
                    high=float(item[2]),
                    low=float(item[3]),
                    close=float(item[4]),
                    volume=float(item[5]),
                    trades_count=int(item[8]),
                )
            )

        return candles

    async def get_orderbook(self, symbol: str, depth: int = 20) -> CanonicalOrderBook:
        raw_symbol = self._to_binance_symbol(symbol)
        clean_sym = self._from_binance_symbol(raw_symbol)
        data = await self._execute_request("/depth", params={"symbol": raw_symbol, "limit": depth})

        bids = [OrderBookLevel(price=float(b[0]), quantity=float(b[1])) for b in data.get("bids", [])]
        asks = [OrderBookLevel(price=float(a[0]), quantity=float(a[1])) for a in data.get("asks", [])]

        spread = round(asks[0].price - bids[0].price, 4) if bids and asks else 0.0
        bid_depth = round(sum(b.quantity for b in bids), 4)
        ask_depth = round(sum(a.quantity for a in asks), 4)

        return CanonicalOrderBook(
            symbol=clean_sym,
            timestamp=datetime.now(timezone.utc),
            bids=bids,
            asks=asks,
            spread=spread,
            bid_depth=bid_depth,
            ask_depth=ask_depth,
        )

    async def get_volume(self, symbol: str) -> CanonicalVolume:
        raw_symbol = self._to_binance_symbol(symbol)
        clean_sym = self._from_binance_symbol(raw_symbol)
        data = await self._execute_request("/ticker/24hr", params={"symbol": raw_symbol})

        return CanonicalVolume(
            symbol=clean_sym,
            volume_24h=float(data["volume"]),
            volume_usd_24h=float(data["quoteVolume"]),
            change_24h=float(data["priceChangePercent"]),
            timestamp=datetime.now(timezone.utc),
        )

    async def get_market_overview(self) -> CanonicalMarketOverview:
        primary_symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT", "LINKUSDT"]
        items: List[CanonicalMarketOverviewItem] = []
        now = datetime.now(timezone.utc)
        total_vol = 0.0

        for raw_sym in primary_symbols:
            try:
                data = await self._execute_request("/ticker/24hr", params={"symbol": raw_sym})
                price = float(data["lastPrice"])
                vol_usd = float(data["quoteVolume"])
                total_vol += vol_usd
                clean_sym = self._from_binance_symbol(raw_sym)

                items.append(
                    CanonicalMarketOverviewItem(
                        symbol=clean_sym,
                        price=price,
                        change_24h=float(data["priceChangePercent"]),
                        volume_24h=float(data["volume"]),
                        high_24h=float(data["highPrice"]),
                        low_24h=float(data["lowPrice"]),
                        timestamp=now,
                    )
                )
            except Exception as exc:
                logger.warning("Failed to fetch Binance 24hr stats for %s: %s", raw_sym, exc)

        return CanonicalMarketOverview(
            items=items,
            total_volume_24h=round(total_vol, 2),
            timestamp=now,
        )

    async def get_asset_metadata(self, symbol: str) -> CanonicalAssetMetadata:
        raw_symbol = self._to_binance_symbol(symbol)
        clean_sym = self._from_binance_symbol(raw_symbol)
        return CanonicalAssetMetadata(
            symbol=clean_sym,
            name=clean_sym,
            asset_class="crypto",
            base_currency=clean_sym,
            quote_currency="USD",
            min_order_size=0.0001,
            price_decimals=2,
            is_active=True,
        )

    async def check_health(self) -> Dict[str, Any]:
        try:
            res = await self._execute_request("/ping")
            return {"status": "healthy", "provider": self.name, "ping": res}
        except Exception as exc:
            return {"status": "unhealthy", "provider": self.name, "error": str(exc)}
