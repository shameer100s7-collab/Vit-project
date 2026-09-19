"""Signal coordination service orchestrating data ingestion, feature extraction, regimes, and aggregation."""

from typing import List, Optional
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ValidationException
from app.core.logging import get_logger
from app.db.database import get_db
from app.db.models.signal import Signal
from app.db.repositories.signal import SignalRepository
from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import MarketStateResult
from app.schemas.signals import (
    AggregatedSignalResult,
    SignalDirection,
    SignalHistoryItem,
)
from app.services.feature_engine.feature_builder import FeatureBuilder
from app.services.market_data import MarketDataService, get_market_data_service
from app.services.market_state import MarketStateService, get_market_state_service
from app.services.signal_engine.aggregator import SignalAggregator

logger = get_logger("ghost.signal_engine.service")


class SignalService:
    """Coordinates end-to-end signal generation, regime conditioning, and database persistence."""

    def __init__(
        self,
        market_data_service: Optional[MarketDataService] = None,
        feature_builder: Optional[FeatureBuilder] = None,
        market_state_service: Optional[MarketStateService] = None,
        aggregator: Optional[SignalAggregator] = None,
    ) -> None:
        self.market_data_service = market_data_service or get_market_data_service()
        self.feature_builder = feature_builder or FeatureBuilder()
        self.market_state_service = market_state_service or get_market_state_service(self.market_data_service)
        self.aggregator = aggregator or SignalAggregator()

    async def get_signal(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
        session: Optional[AsyncSession] = None,
    ) -> AggregatedSignalResult:
        """Generates live multi-strategy consensus signal for an asset with regime conditioning."""
        clean_symbol = symbol.upper().strip()

        # 1. Fetch candles
        candles = await self.market_data_service.get_ohlcv(
            symbol=clean_symbol,
            timeframe=timeframe,
            limit=limit,
            session=session,
        )

        if not candles or len(candles) < 5:
            raise ValidationException(
                f"Insufficient historical data for {clean_symbol}: minimum 5 candles required for signals."
            )

        # 2. Fetch orderbook
        orderbook = None
        try:
            orderbook = await self.market_data_service.get_orderbook(clean_symbol, depth=20)
        except Exception as exc:
            logger.warning("Orderbook unavailable for %s signal generation: %s", clean_symbol, exc)

        # 3. Build quantitative features
        snapshot: FeatureSnapshot = self.feature_builder.build_inference_features(
            symbol=clean_symbol,
            candles=candles,
            orderbook=orderbook,
        )

        # 4. Evaluate Macro Market Regime
        market_state: MarketStateResult = self.market_state_service.classifier.classify(
            snapshot=snapshot,
            timeframe=timeframe,
        )

        # 5. Aggregate Strategy Ensemble
        result: AggregatedSignalResult = self.aggregator.aggregate(
            snapshot=snapshot,
            market_state=market_state,
            timeframe=timeframe,
        )

        # 6. Persist to database if session is present
        if session:
            try:
                repo = SignalRepository(session)
                await repo.create(
                    symbol=clean_symbol,
                    direction=result.direction.value,
                    confidence=result.confidence,
                    strength=result.strength,
                    time_horizon=result.time_horizon.value,
                    reasons=result.reasons,
                    features_snapshot=snapshot.features,
                    model_version=result.model_version,
                    status="ACTIVE",
                    timestamp=result.timestamp,
                )
                await session.commit()
            except Exception as exc:
                logger.error("Failed to persist signal for %s: %s", clean_symbol, exc)

        return result

    async def get_recent_signals(
        self,
        symbol: Optional[str] = None,
        limit: int = 50,
        session: Optional[AsyncSession] = None,
    ) -> List[SignalHistoryItem]:
        """Retrieves recently generated and persisted signals from the repository."""
        if not session:
            return []

        repo = SignalRepository(session)
        signals = await repo.get_latest_signals(symbol=symbol, limit=limit)
        return [
            SignalHistoryItem(
                id=str(s.id),
                symbol=s.symbol,
                direction=SignalDirection(s.direction),
                confidence=s.confidence,
                strength=s.strength,
                time_horizon=s.time_horizon,
                reasons=s.reasons,
                status=s.status,
                model_version=s.model_version,
                timestamp=s.timestamp,
            )
            for s in signals
        ]


# Singleton instance
_signal_service_instance: Optional[SignalService] = None


def get_signal_service(
    market_data_service: MarketDataService = Depends(get_market_data_service),
    market_state_service: MarketStateService = Depends(get_market_state_service),
) -> SignalService:
    """Factory dependency providing SignalService singleton."""
    global _signal_service_instance
    if _signal_service_instance is None:
        _signal_service_instance = SignalService(
            market_data_service=market_data_service,
            market_state_service=market_state_service,
        )
    return _signal_service_instance
