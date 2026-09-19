"""Market Data Engine providing abstract, mock, and real providers with canonical normalization."""

from app.services.market_data.base import MarketDataProvider
from app.services.market_data.mock_provider import MockMarketDataProvider
from app.services.market_data.real_provider import BinanceMarketDataProvider
from app.services.market_data.service import MarketDataService, get_market_data_service

__all__ = [
    "MarketDataProvider",
    "MockMarketDataProvider",
    "BinanceMarketDataProvider",
    "MarketDataService",
    "get_market_data_service",
]
