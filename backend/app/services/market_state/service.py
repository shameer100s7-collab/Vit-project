"""Market state service coordinating data ingestion, feature generation, and regime classification."""

from typing import Optional
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ValidationException
from app.core.logging import get_logger
from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import MarketStateResult
from app.services.feature_engine.feature_builder import FeatureBuilder
from app.services.market_data import MarketDataService, get_market_data_service
from app.services.market_state.base import MarketStateClassifier
from app.services.market_state.rule_based import RuleBasedMarketStateClassifier

logger = get_logger("ghost.market_state.service")


class MarketStateService:
    """Coordinates market data retrieval, quantitative feature computation, and regime classification."""

    def __init__(
        self,
        market_data_service: Optional[MarketDataService] = None,
        feature_builder: Optional[FeatureBuilder] = None,
        classifier: Optional[MarketStateClassifier] = None,
    ) -> None:
        self.market_data_service = market_data_service or get_market_data_service()
        self.feature_builder = feature_builder or FeatureBuilder()
        self.classifier = classifier or RuleBasedMarketStateClassifier()

    async def get_market_state(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
        session: Optional[AsyncSession] = None,
    ) -> MarketStateResult:
        """Computes real-time market regime for an asset using historical candles and depth of market.

        Args:
            symbol: Target cryptocurrency ticker symbol (e.g. BTC, ETH, SOL).
            timeframe: Candle interval (default '1h').
            limit: Number of warmup candles to consume (minimum 5, default 100).
            session: Optional async database session.

        Returns:
            MarketStateResult with classified regime, evidence, scores, and bounded confidence.
        """
        clean_symbol = symbol.upper().strip()

        # 1. Fetch OHLCV candles
        candles = await self.market_data_service.get_ohlcv(
            symbol=clean_symbol,
            timeframe=timeframe,
            limit=limit,
            session=session,
        )

        if not candles or len(candles) < 5:
            raise ValidationException(
                f"Insufficient market data for {clean_symbol}: minimum 5 candles required for indicators."
            )

        # 2. Fetch orderbook depth if available
        orderbook = None
        try:
            orderbook = await self.market_data_service.get_orderbook(clean_symbol, depth=20)
        except Exception as exc:
            logger.warning("Orderbook retrieval unavailable for %s: %s. Proceeding with price-only indicators.", clean_symbol, exc)

        # 3. Build quantitative feature snapshot
        snapshot: FeatureSnapshot = self.feature_builder.build_inference_features(
            symbol=clean_symbol,
            candles=candles,
            orderbook=orderbook,
        )

        # 4. Classify regime using deterministic classifier
        result: MarketStateResult = self.classifier.classify(snapshot=snapshot, timeframe=timeframe)
        return result


# Singleton instance
_market_state_service_instance: Optional[MarketStateService] = None


def get_market_state_service(
    market_data_service: MarketDataService = Depends(get_market_data_service),
) -> MarketStateService:
    """Factory dependency providing MarketStateService singleton."""
    global _market_state_service_instance
    if _market_state_service_instance is None:
        _market_state_service_instance = MarketStateService(market_data_service=market_data_service)
    return _market_state_service_instance
