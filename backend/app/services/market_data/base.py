"""Abstract base market data provider interface."""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.schemas.market import (
    CanonicalAssetMetadata,
    CanonicalCandle,
    CanonicalMarketOverview,
    CanonicalOrderBook,
    CanonicalPrice,
    CanonicalVolume,
)


class MarketDataProvider(ABC):
    """Abstract interface for all market data ingestion sources."""

    name: str = "base"

    @abstractmethod
    async def get_current_price(self, symbol: str) -> CanonicalPrice:
        """Fetches normalized current price for a symbol."""
        pass

    @abstractmethod
    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> List[CanonicalCandle]:
        """Fetches normalized chronological OHLCV candles."""
        pass

    @abstractmethod
    async def get_orderbook(self, symbol: str, depth: int = 20) -> CanonicalOrderBook:
        """Fetches normalized orderbook depth."""
        pass

    @abstractmethod
    async def get_volume(self, symbol: str) -> CanonicalVolume:
        """Fetches normalized 24-hour volume and turnover."""
        pass

    @abstractmethod
    async def get_market_overview(self) -> CanonicalMarketOverview:
        """Fetches high-level summary overview of primary crypto assets."""
        pass

    @abstractmethod
    async def get_asset_metadata(self, symbol: str) -> CanonicalAssetMetadata:
        """Fetches static metadata, tick sizes, and lot constraints for a symbol."""
        pass

    @abstractmethod
    async def check_health(self) -> Dict[str, Any]:
        """Returns health probe metrics for the underlying provider feed."""
        pass
