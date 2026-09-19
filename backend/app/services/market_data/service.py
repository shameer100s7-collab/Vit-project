"""Market data coordination service handling provider dispatch, caching, and persistence."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundException, ProviderException
from app.core.logging import get_logger
from app.db.repositories.market import MarketDataRepository
from app.schemas.market import (
    CanonicalAssetMetadata,
    CanonicalCandle,
    CanonicalMarketOverview,
    CanonicalOrderBook,
    CanonicalPrice,
    CanonicalVolume,
    TradableSymbolItem,
)
from app.services.market_data.base import MarketDataProvider
from app.services.market_data.cache import MarketDataCache
from app.services.market_data.mock_provider import MockMarketDataProvider
from app.services.market_data.real_provider import BinanceMarketDataProvider

logger = get_logger("ghost.market_data.service")


class MarketDataService:
    """Coordinates market data provider feeds, caching, and database persistence."""

    def __init__(
        self,
        provider: Optional[MarketDataProvider] = None,
        cache: Optional[MarketDataCache] = None,
    ) -> None:
        self.cache = cache or MarketDataCache()

        if provider:
            self.provider = provider
        elif settings.MARKET_DATA_PROVIDER.lower() == "binance":
            self.provider = BinanceMarketDataProvider()
        else:
            self.provider = MockMarketDataProvider()

        # Silent fallback to mock is only enabled when explicitly configured
        self._allow_mock_fallback = settings.MARKET_DATA_PROVIDER.lower() == "mock"
        self.fallback_provider = MockMarketDataProvider() if self._allow_mock_fallback else None

    async def get_current_price(
        self,
        symbol: str,
        session: Optional[AsyncSession] = None,
    ) -> CanonicalPrice:
        """Retrieves price with caching and optional database snapshot recording."""
        clean_symbol = symbol.upper().strip()
        cache_key = f"price:{clean_symbol}"

        cached = await self.cache.get(cache_key)
        if cached:
            return cached

        try:
            price_data = await self.provider.get_current_price(clean_symbol)
        except NotFoundException:
            raise
        except Exception as exc:
            if self._allow_mock_fallback and self.fallback_provider:
                logger.warning("Primary provider '%s' failed for %s (%s). Using fallback mock.", self.provider.name, clean_symbol, exc)
                price_data = await self.fallback_provider.get_current_price(clean_symbol)
            else:
                logger.error("Market data provider '%s' failed for price %s: %s", self.provider.name, clean_symbol, exc)
                raise ProviderException(f"Live market price unavailable for {clean_symbol} from {self.provider.name}: {exc}")

        await self.cache.set(cache_key, price_data, ttl_seconds=settings.MARKET_DATA_CACHE_TTL)

        # Persist snapshot if database session provided
        if session:
            try:
                repo = MarketDataRepository(session)
                await repo.snapshot_repo.create(
                    symbol=price_data.symbol,
                    price=price_data.price,
                    timestamp=price_data.timestamp,
                )
            except Exception as db_exc:
                logger.warning("Failed to persist snapshot for %s: %s", clean_symbol, db_exc)

        return price_data

    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        session: Optional[AsyncSession] = None,
    ) -> List[CanonicalCandle]:
        """Retrieves chronological candles with caching."""
        clean_symbol = symbol.upper().strip()
        cache_key = f"candles:{clean_symbol}:{timeframe}:{limit}"

        cached = await self.cache.get(cache_key)
        if cached and not start and not end:
            return cached

        try:
            candles = await self.provider.get_ohlcv(
                clean_symbol,
                timeframe=timeframe,
                limit=limit,
                start=start,
                end=end,
            )
        except NotFoundException:
            raise
        except Exception as exc:
            if self._allow_mock_fallback and self.fallback_provider:
                logger.warning("Primary provider failed for %s OHLCV: %s. Using fallback mock.", clean_symbol, exc)
                candles = await self.fallback_provider.get_ohlcv(
                    clean_symbol,
                    timeframe=timeframe,
                    limit=limit,
                    start=start,
                    end=end,
                )
            else:
                logger.error("Market data provider failed for OHLCV %s: %s", clean_symbol, exc)
                raise ProviderException(f"Live OHLCV data unavailable for {clean_symbol}: {exc}")

        if not start and not end:
            await self.cache.set(cache_key, candles, ttl_seconds=settings.MARKET_DATA_CACHE_TTL)

        return candles

    async def get_orderbook(self, symbol: str, depth: int = 20) -> CanonicalOrderBook:
        """Retrieves depth of market orderbook with 3-second cache."""
        clean_symbol = symbol.upper().strip()
        cache_key = f"orderbook:{clean_symbol}:{depth}"

        cached = await self.cache.get(cache_key)
        if cached:
            return cached

        try:
            orderbook = await self.provider.get_orderbook(clean_symbol, depth=depth)
        except NotFoundException:
            raise
        except Exception as exc:
            if self._allow_mock_fallback and self.fallback_provider:
                logger.warning("Primary provider failed for %s orderbook: %s. Using fallback mock.", clean_symbol, exc)
                orderbook = await self.fallback_provider.get_orderbook(clean_symbol, depth=depth)
            else:
                logger.error("Market data provider failed for orderbook %s: %s", clean_symbol, exc)
                raise ProviderException(f"Live order book unavailable for {clean_symbol}: {exc}")

        await self.cache.set(cache_key, orderbook, ttl_seconds=3)
        return orderbook

    async def get_volume(self, symbol: str) -> CanonicalVolume:
        """Retrieves 24-hour volume statistics."""
        clean_symbol = symbol.upper().strip()
        cache_key = f"volume:{clean_symbol}"

        cached = await self.cache.get(cache_key)
        if cached:
            return cached

        try:
            vol = await self.provider.get_volume(clean_symbol)
        except NotFoundException:
            raise
        except Exception as exc:
            if self._allow_mock_fallback and self.fallback_provider:
                logger.warning("Primary provider failed for %s volume: %s. Using fallback mock.", clean_symbol, exc)
                vol = await self.fallback_provider.get_volume(clean_symbol)
            else:
                logger.error("Market data provider failed for volume %s: %s", clean_symbol, exc)
                raise ProviderException(f"Live 24h ticker statistics unavailable for {clean_symbol}: {exc}")

        await self.cache.set(cache_key, vol, ttl_seconds=settings.MARKET_DATA_CACHE_TTL)
        return vol

    async def get_market_overview(self) -> CanonicalMarketOverview:
        """Retrieves global market overview with 15-second cache."""
        cache_key = "market_overview"
        cached = await self.cache.get(cache_key)
        if cached:
            return cached

        try:
            overview = await self.provider.get_market_overview()
        except Exception as exc:
            if self._allow_mock_fallback and self.fallback_provider:
                logger.warning("Primary provider overview failed: %s. Using fallback mock.", exc)
                overview = await self.fallback_provider.get_market_overview()
            else:
                logger.error("Market data provider overview failed: %s", exc)
                raise ProviderException(f"Live market overview unavailable: {exc}")

        await self.cache.set(cache_key, overview, ttl_seconds=15)
        return overview

    async def get_asset_metadata(self, symbol: str) -> CanonicalAssetMetadata:
        """Retrieves static metadata for symbol."""
        clean_symbol = symbol.upper().strip()
        return await self.provider.get_asset_metadata(clean_symbol)

    async def get_tradable_symbols(self) -> List[TradableSymbolItem]:
        """Discovers tradable instruments directly from provider."""
        return await self.provider.get_tradable_symbols()

    async def check_health(self) -> Dict[str, Any]:
        """Returns health probe metrics for the active provider."""
        return await self.provider.check_health()

    # Convenient backward-compatible aliases
    get_volume_24h = get_volume
    get_latest_price = get_current_price
    get_candles = get_ohlcv
    get_order_book = get_orderbook



# Singleton instance
_market_data_service_instance: Optional[MarketDataService] = None


def get_market_data_service() -> MarketDataService:
    """Factory dependency returning MarketDataService singleton."""
    global _market_data_service_instance
    if _market_data_service_instance is None:
        _market_data_service_instance = MarketDataService()
    return _market_data_service_instance
