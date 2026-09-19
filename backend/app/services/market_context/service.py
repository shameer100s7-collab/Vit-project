"""Market Context Service coordinating visual quality gates, market data, and context synthesis."""

import asyncio
from typing import Optional
from app.core.logging import get_logger
from app.schemas.market_context import MarketContextRequest, MarketContextResult, ScreenshotQualityGateResult
from app.services.market_context.engine import MarketContextEngine
from app.services.market_context.quality_gate import ScreenshotQualityGate
from app.services.market_data import MarketDataService, get_market_data_service

logger = get_logger("ghost.market_context.service")


class MarketContextService:
    """Coordinates screenshot quality checks, telemetry gathering, and market context generation."""

    def __init__(
        self,
        market_data_service: Optional[MarketDataService] = None,
        engine: Optional[MarketContextEngine] = None,
    ) -> None:
        self.market_data_service = market_data_service or get_market_data_service()
        self.engine = engine or MarketContextEngine()
        self.quality_gate = ScreenshotQualityGate()

    def check_quality(
        self,
        image_data: str,
        asset: Optional[str] = None,
        timeframe: Optional[str] = None,
        has_volume: bool = True,
    ) -> ScreenshotQualityGateResult:
        """Fast pre-flight check to verify screenshot clarity before full analysis."""
        return self.quality_gate.evaluate(
            image_data=image_data,
            asset=asset,
            timeframe=timeframe,
            has_volume=has_volume,
        )

    async def analyze_context(self, request: MarketContextRequest) -> MarketContextResult:
        """Executes full quality-gated market context analysis."""
        clean_symbol = request.asset.replace("/", "").replace("-", "").strip().upper()
        timeframe = request.timeframe.strip()

        logger.info(
            "Analyzing market context for %s (%s) with uploaded screenshot...",
            request.asset,
            timeframe,
        )

        # 1. Fetch real market telemetry asynchronously (non-blocking fallback)
        candles = None
        price = None
        ticker = None

        try:
            candles_task = self.market_data_service.get_ohlcv(clean_symbol, timeframe=timeframe, limit=50)
            price_task = self.market_data_service.get_current_price(clean_symbol)
            ticker_task = self.market_data_service.get_volume_24h(clean_symbol)

            candles, price, ticker = await asyncio.gather(
                candles_task, price_task, ticker_task, return_exceptions=True
            )

            if isinstance(candles, Exception):
                logger.warning("Market candles fetch exception: %s", candles)
                candles = None
            if isinstance(price, Exception):
                logger.warning("Price fetch exception: %s", price)
                price = None
            if isinstance(ticker, Exception):
                logger.warning("Ticker fetch exception: %s", ticker)
                ticker = None

        except Exception as exc:
            logger.warning("Could not fetch auxiliary market data for context engine: %s", exc)

        # 2. Run adversarial market context engine
        return self.engine.analyze_context(
            request=request,
            candles=candles if isinstance(candles, list) else None,
            live_price=price if not isinstance(price, Exception) else None,
            ticker_24h=ticker if not isinstance(ticker, Exception) else None,
        )


# Global singleton instance
_market_context_service: Optional[MarketContextService] = None


def get_market_context_service() -> MarketContextService:
    """FastAPI dependency provider for MarketContextService."""
    global _market_context_service
    if _market_context_service is None:
        _market_context_service = MarketContextService()
    return _market_context_service
