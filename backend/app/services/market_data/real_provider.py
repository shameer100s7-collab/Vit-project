"""Binance public REST API market data provider adapter with strict data integrity."""

import asyncio
from datetime import datetime, timezone
import math
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
    TradableSymbolItem,
)
from app.services.market_data.base import MarketDataProvider

logger = get_logger("ghost.market_data.binance")


class BinanceMarketDataProvider(MarketDataProvider):
    """Production authoritative public REST market data provider connecting to Binance Spot."""

    name: str = "binance"
    source_name: str = "Binance Spot"

    def __init__(self, base_url: Optional[str] = None, timeout: float = 6.0) -> None:
        self.base_url = base_url or settings.BINANCE_API_URL
        self.timeout = timeout
        self._symbols_cache: List[TradableSymbolItem] = []
        self._symbols_cache_time: Optional[datetime] = None

    def _to_binance_symbol(self, symbol: str) -> str:
        """Converts user or canonical representation to Binance spot instrument."""
        sym = symbol.upper().replace("-", "").replace("/", "").strip()
        # If already a standard pair like BTCUSDT, ETHBTC, SOLUSDC
        valid_quotes = ("USDT", "BUSD", "USDC", "FDUSD")
        if any(sym.endswith(q) for q in valid_quotes) and len(sym) > 4:
            return sym
        if sym.endswith("BTC") and len(sym) > 3:
            return sym
        if sym.endswith("ETH") and len(sym) > 3:
            return sym
        return f"{sym}USDT"

    def _from_binance_symbol(self, raw_symbol: str) -> str:
        """Extracts canonical base ticker for compatibility."""
        sym = raw_symbol.upper()
        for q in ("USDT", "BUSD", "USDC", "FDUSD"):
            if sym.endswith(q):
                return sym[: -len(q)]
        return sym

    def _to_display_symbol(self, raw_symbol: str) -> str:
        """Formats raw Binance ticker to display format like BTC/USDT."""
        sym = raw_symbol.upper()
        for q in ("USDT", "BUSD", "USDC", "FDUSD"):
            if sym.endswith(q):
                base = sym[: -len(q)]
                return f"{base}/{q}"
        return sym

    async def _execute_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Executes HTTP request with rate limit handling and error classification."""
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
                        raise NotFoundException(f"Symbol not recognized by Binance Spot: {params.get('symbol') if params else ''}")
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
                    raise ProviderException(f"Live market data unavailable (Binance connection failed): {exc}")
                await asyncio.sleep(delay)
                delay *= 2

    async def get_current_price(self, symbol: str) -> CanonicalPrice:
        raw_symbol = self._to_binance_symbol(symbol)
        clean_sym = self._from_binance_symbol(raw_symbol)

        # Retrieve authoritative last price
        data = await self._execute_request("/ticker/price", params={"symbol": raw_symbol})
        price_val = float(data["price"])

        # Attempt to also get top-of-book bid/ask
        bid_price = None
        ask_price = None
        try:
            book_data = await self._execute_request("/ticker/bookTicker", params={"symbol": raw_symbol})
            bid_price = float(book_data.get("bidPrice", 0)) or None
            ask_price = float(book_data.get("askPrice", 0)) or None
        except Exception:
            pass

        return CanonicalPrice(
            symbol=clean_sym,
            price=price_val,
            currency="USD",
            source=self.source_name,
            bid_price=bid_price,
            ask_price=ask_price,
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

        # Supported intervals validation
        valid_intervals = {"1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"}
        interval = timeframe if timeframe in valid_intervals else "1h"

        params: Dict[str, Any] = {
            "symbol": raw_symbol,
            "interval": interval,
            "limit": min(limit, 1000),
        }
        if start:
            params["startTime"] = int(start.timestamp() * 1000)
        if end:
            params["endTime"] = int(end.timestamp() * 1000)

        raw_klines = await self._execute_request("/klines", params=params)
        candles: List[CanonicalCandle] = []

        for item in raw_klines:
            # Binance kline structure:
            # [0: openTime, 1: open, 2: high, 3: low, 4: close, 5: volume, 6: closeTime, 7: quoteVol, 8: count, ...]
            try:
                open_val = float(item[1])
                high_val = float(item[2])
                low_val = float(item[3])
                close_val = float(item[4])
                vol_val = float(item[5])
                quote_vol = float(item[7])
                trade_count = int(item[8])

                # Mathematical sanity validation: Reject corrupt records
                if not (math.isfinite(open_val) and math.isfinite(high_val) and math.isfinite(low_val) and math.isfinite(close_val)):
                    logger.warning("Rejecting non-finite kline: %s", item)
                    continue

                if high_val < max(open_val, close_val) or low_val > min(open_val, close_val) or vol_val < 0.0:
                    logger.warning("Rejecting logically invalid kline: %s", item)
                    continue

                open_time = datetime.fromtimestamp(item[0] / 1000.0, tz=timezone.utc)
                close_time = datetime.fromtimestamp(item[6] / 1000.0, tz=timezone.utc)

                candles.append(
                    CanonicalCandle(
                        symbol=clean_sym,
                        timeframe=interval,
                        timestamp=open_time,
                        close_time=close_time,
                        open=open_val,
                        high=high_val,
                        low=low_val,
                        close=close_val,
                        volume=vol_val,
                        quote_volume=quote_vol,
                        trades_count=trade_count,
                        source=self.source_name,
                    )
                )
            except (ValueError, TypeError, IndexError) as parse_err:
                logger.warning("Error parsing Binance kline %s: %s", item, parse_err)
                continue

        return candles

    async def get_orderbook(self, symbol: str, depth: int = 20) -> CanonicalOrderBook:
        raw_symbol = self._to_binance_symbol(symbol)
        clean_sym = self._from_binance_symbol(raw_symbol)

        # Binance valid depth limits: 5, 10, 20, 50, 100, 500, 1000, 5000
        valid_limits = [5, 10, 20, 50, 100]
        actual_limit = min([l for l in valid_limits if l >= depth] or [100])

        data = await self._execute_request("/depth", params={"symbol": raw_symbol, "limit": actual_limit})

        raw_bids = data.get("bids", [])
        raw_asks = data.get("asks", [])
        last_update_id = int(data.get("lastUpdateId", 0))

        bids = [
            OrderBookLevel(price=float(b[0]), quantity=float(b[1]))
            for b in raw_bids[:depth]
            if len(b) >= 2 and float(b[1]) > 0
        ]
        asks = [
            OrderBookLevel(price=float(a[0]), quantity=float(a[1]))
            for a in raw_asks[:depth]
            if len(a) >= 2 and float(a[1]) > 0
        ]

        # Ensure correct ordering: bids descending, asks ascending
        bids.sort(key=lambda x: x.price, reverse=True)
        asks.sort(key=lambda x: x.price)

        spread = round(asks[0].price - bids[0].price, 6) if bids and asks else 0.0
        spread_pct = round((spread / asks[0].price) * 100.0, 4) if asks and asks[0].price > 0 else 0.0
        bid_depth = round(sum(b.quantity for b in bids), 4)
        ask_depth = round(sum(a.quantity for a in asks), 4)

        return CanonicalOrderBook(
            symbol=clean_sym,
            timestamp=datetime.now(timezone.utc),
            bids=bids,
            asks=asks,
            spread=spread,
            spread_pct=spread_pct,
            bid_depth=bid_depth,
            ask_depth=ask_depth,
            last_update_id=last_update_id,
            source=self.source_name,
        )

    async def get_volume(self, symbol: str) -> CanonicalVolume:
        """Fetches authoritative 24-hour ticker statistics from Binance."""
        raw_symbol = self._to_binance_symbol(symbol)
        clean_sym = self._from_binance_symbol(raw_symbol)

        data = await self._execute_request("/ticker/24hr", params={"symbol": raw_symbol})

        vol_base = float(data.get("volume", 0.0))
        vol_quote = float(data.get("quoteVolume", 0.0))
        price_change_pct = float(data.get("priceChangePercent", 0.0))
        price_change = float(data.get("priceChange", 0.0))
        high_24h = float(data.get("highPrice", 0.0))
        low_24h = float(data.get("lowPrice", 0.0))
        open_price = float(data.get("openPrice", 0.0))
        last_price = float(data.get("lastPrice", 0.0))
        trades_count = int(data.get("count", 0))
        bid_price = float(data.get("bidPrice", 0.0)) or None
        ask_price = float(data.get("askPrice", 0.0)) or None
        close_time_ms = int(data.get("closeTime", 0))

        obs_time = datetime.fromtimestamp(close_time_ms / 1000.0, tz=timezone.utc) if close_time_ms else datetime.now(timezone.utc)

        return CanonicalVolume(
            symbol=clean_sym,
            volume_24h=vol_base,
            volume_usd_24h=vol_quote,
            quote_volume_24h=vol_quote,
            change_24h=price_change_pct,
            price_change_pct_24h=price_change_pct,
            price_change_24h=price_change,
            high_24h=high_24h,
            low_24h=low_24h,
            open_price_24h=open_price,
            last_price=last_price,
            trades_count_24h=trades_count,
            bid_price=bid_price,
            ask_price=ask_price,
            source=self.source_name,
            timestamp=obs_time,
        )

    async def get_tradable_symbols(self) -> List[TradableSymbolItem]:
        """Discovers active spot instruments directly from Binance exchange specifications."""
        now = datetime.now(timezone.utc)
        if self._symbols_cache and self._symbols_cache_time and (now - self._symbols_cache_time).total_seconds() < 3600:
            return self._symbols_cache

        try:
            data = await self._execute_request("/exchangeInfo", params={"permissions": "SPOT"})
            raw_symbols = data.get("symbols", [])
            items: List[TradableSymbolItem] = []

            for s in raw_symbols:
                if s.get("status") != "TRADING":
                    continue
                quote_asset = s.get("quoteAsset", "")
                if quote_asset not in ("USDT", "FDUSD", "USDC"):
                    continue

                base_asset = s.get("baseAsset", "")
                raw_sym = s.get("symbol", "")
                disp_sym = f"{base_asset}/{quote_asset}"

                # Calculate precision from filters
                price_precision = 2
                qty_precision = 4
                min_order_qty = 0.0001

                for f in s.get("filters", []):
                    if f.get("filterType") == "PRICE_FILTER":
                        tick_size = float(f.get("tickSize", 0.01))
                        if tick_size > 0:
                            price_precision = max(0, -int(math.floor(math.log10(tick_size))))
                    elif f.get("filterType") == "LOT_SIZE":
                        step_size = float(f.get("stepSize", 0.0001))
                        min_qty = float(f.get("minQty", 0.0001))
                        min_order_qty = min_qty
                        if step_size > 0:
                            qty_precision = max(0, -int(math.floor(math.log10(step_size))))

                items.append(
                    TradableSymbolItem(
                        symbol=raw_sym,
                        display_symbol=disp_sym,
                        base_asset=base_asset,
                        quote_asset=quote_asset,
                        status="TRADING",
                        price_precision=price_precision,
                        quantity_precision=qty_precision,
                        min_order_quantity=min_order_qty,
                        is_active=True,
                    )
                )

            # Prioritize standard major coins
            priority_bases = {"BTC": 1, "ETH": 2, "SOL": 3, "BNB": 4, "XRP": 5, "ADA": 6, "AVAX": 7, "LINK": 8, "DOGE": 9, "DOT": 10}
            items.sort(key=lambda x: (priority_bases.get(x.base_asset, 999), x.base_asset))

            self._symbols_cache = items
            self._symbols_cache_time = now
            return items
        except Exception as exc:
            logger.error("Failed to discover tradable symbols from Binance: %s", exc)
            if self._symbols_cache:
                return self._symbols_cache
            # Minimal fallback if network completely fails on initial startup
            return [
                TradableSymbolItem(symbol="BTCUSDT", display_symbol="BTC/USDT", base_asset="BTC", quote_asset="USDT", price_precision=2, quantity_precision=5, min_order_quantity=0.00001),
                TradableSymbolItem(symbol="ETHUSDT", display_symbol="ETH/USDT", base_asset="ETH", quote_asset="USDT", price_precision=2, quantity_precision=4, min_order_quantity=0.0001),
                TradableSymbolItem(symbol="SOLUSDT", display_symbol="SOL/USDT", base_asset="SOL", quote_asset="USDT", price_precision=2, quantity_precision=2, min_order_quantity=0.01),
                TradableSymbolItem(symbol="BNBUSDT", display_symbol="BNB/USDT", base_asset="BNB", quote_asset="USDT", price_precision=2, quantity_precision=3, min_order_quantity=0.001),
                TradableSymbolItem(symbol="XRPUSDT", display_symbol="XRP/USDT", base_asset="XRP", quote_asset="USDT", price_precision=4, quantity_precision=1, min_order_quantity=0.1),
                TradableSymbolItem(symbol="ADAUSDT", display_symbol="ADA/USDT", base_asset="ADA", quote_asset="USDT", price_precision=4, quantity_precision=1, min_order_quantity=0.1),
                TradableSymbolItem(symbol="DOGEUSDT", display_symbol="DOGE/USDT", base_asset="DOGE", quote_asset="USDT", price_precision=5, quantity_precision=0, min_order_quantity=1.0),
                TradableSymbolItem(symbol="AVAXUSDT", display_symbol="AVAX/USDT", base_asset="AVAX", quote_asset="USDT", price_precision=2, quantity_precision=2, min_order_quantity=0.01),
                TradableSymbolItem(symbol="LINKUSDT", display_symbol="LINK/USDT", base_asset="LINK", quote_asset="USDT", price_precision=3, quantity_precision=2, min_order_quantity=0.01),
                TradableSymbolItem(symbol="DOTUSDT", display_symbol="DOT/USDT", base_asset="DOT", quote_asset="USDT", price_precision=3, quantity_precision=2, min_order_quantity=0.01),
                TradableSymbolItem(symbol="NEARUSDT", display_symbol="NEAR/USDT", base_asset="NEAR", quote_asset="USDT", price_precision=3, quantity_precision=1, min_order_quantity=0.1),
                TradableSymbolItem(symbol="SUIUSDT", display_symbol="SUI/USDT", base_asset="SUI", quote_asset="USDT", price_precision=4, quantity_precision=1, min_order_quantity=0.1),
                TradableSymbolItem(symbol="LTCUSDT", display_symbol="LTC/USDT", base_asset="LTC", quote_asset="USDT", price_precision=2, quantity_precision=3, min_order_quantity=0.001),
            ]

    async def get_asset_metadata(self, symbol: str) -> CanonicalAssetMetadata:
        raw_symbol = self._to_binance_symbol(symbol)
        clean_sym = self._from_binance_symbol(raw_symbol)

        price_precision = 2
        min_order_qty = 0.0001
        base_asset = clean_sym
        quote_asset = "USDT"

        try:
            data = await self._execute_request("/exchangeInfo", params={"symbol": raw_symbol})
            sym_info = data.get("symbols", [{}])[0]
            base_asset = sym_info.get("baseAsset", clean_sym)
            quote_asset = sym_info.get("quoteAsset", "USDT")
            for f in sym_info.get("filters", []):
                if f.get("filterType") == "PRICE_FILTER":
                    tick = float(f.get("tickSize", 0.01))
                    if tick > 0:
                        price_precision = max(0, -int(math.floor(math.log10(tick))))
                elif f.get("filterType") == "LOT_SIZE":
                    min_order_qty = float(f.get("minQty", 0.0001))
        except Exception as exc:
            logger.warning("Could not fetch detailed metadata for %s from Binance: %s", raw_symbol, exc)

        WELL_KNOWN_NAMES = {
            "BTC": "Bitcoin",
            "ETH": "Ethereum",
            "SOL": "Solana",
            "BNB": "BNB",
            "AVAX": "Avalanche",
            "LINK": "Chainlink",
            "ADA": "Cardano",
            "XRP": "XRP",
            "DOGE": "Dogecoin",
            "DOT": "Polkadot",
        }
        friendly_name = WELL_KNOWN_NAMES.get(clean_sym, f"{base_asset} / {quote_asset}")

        return CanonicalAssetMetadata(
            symbol=clean_sym,
            name=friendly_name,
            asset_class="crypto",
            base_currency=base_asset,
            quote_currency=quote_asset,
            base_asset=base_asset,
            quote_asset=quote_asset,
            min_order_size=min_order_qty,
            min_order_quantity=min_order_qty,
            price_decimals=price_precision,
            price_precision=price_precision,
            is_active=True,
        )

    async def get_market_overview(self) -> CanonicalMarketOverview:
        primary_symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT"]
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
                        source=self.source_name,
                        timestamp=now,
                    )
                )
            except Exception as exc:
                logger.warning("Failed to fetch Binance 24hr stats for %s: %s", raw_sym, exc)

        return CanonicalMarketOverview(
            items=items,
            total_volume_24h=round(total_vol, 2),
            source=self.source_name,
            timestamp=now,
        )

    async def check_health(self) -> Dict[str, Any]:
        try:
            start = datetime.now(timezone.utc)
            res = await self._execute_request("/ping")
            elapsed_ms = round((datetime.now(timezone.utc) - start).total_seconds() * 1000, 1)
            return {
                "status": "healthy",
                "provider": self.name,
                "source": self.source_name,
                "latency_ms": elapsed_ms,
                "ping": res,
            }
        except Exception as exc:
            return {
                "status": "unhealthy",
                "provider": self.name,
                "source": self.source_name,
                "error": str(exc),
            }
