"""Behavior model coordination service orchestrating liquidity, whale activity, and participant models."""

from typing import Optional
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationException
from app.core.logging import get_logger
from app.schemas.behavior import BehaviorAnalysisResult
from app.schemas.features import FeatureSnapshot
from app.services.behavior_model.liquidity_model import LiquidityModel
from app.services.behavior_model.participant_model import ParticipantModel
from app.services.behavior_model.whale_activity import WhaleActivityDetector
from app.services.feature_engine.feature_builder import FeatureBuilder
from app.services.market_data import MarketDataService, get_market_data_service

logger = get_logger("ghost.behavior_model.service")


class BehaviorModelService:
    """Coordinates observable market behavior analysis and participant flow modeling."""

    def __init__(
        self,
        market_data_service: Optional[MarketDataService] = None,
        feature_builder: Optional[FeatureBuilder] = None,
    ) -> None:
        self.market_data_service = market_data_service or get_market_data_service()
        self.feature_builder = feature_builder or FeatureBuilder()

    async def analyze_behavior(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
        session: Optional[AsyncSession] = None,
    ) -> BehaviorAnalysisResult:
        """Evaluates observable market microstructure footprints to infer participant behavior."""
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
                f"Insufficient historical data for {clean_symbol}: minimum 5 candles required for behavioral modeling."
            )

        # 2. Fetch orderbook
        orderbook = None
        try:
            orderbook = await self.market_data_service.get_orderbook(clean_symbol, depth=20)
        except Exception as exc:
            logger.warning("Orderbook unavailable for %s behavior analysis: %s", clean_symbol, exc)

        # 3. Build features
        snapshot: FeatureSnapshot = self.feature_builder.build_inference_features(
            symbol=clean_symbol,
            candles=candles,
            orderbook=orderbook,
        )

        # 4. Evaluate Liquidity Pressure (and collect factual observations)
        liquidity_pressure, liquidity_observations = LiquidityModel.evaluate_liquidity(
            orderbook=orderbook,
            close_price=snapshot.features.get("close", 1.0),
        )

        # 5. Evaluate Whale Activity (and collect factual observations)
        whale_activity, whale_observations = WhaleActivityDetector.detect_whale_activity(
            snapshot=snapshot,
            orderbook=orderbook,
        )

        # Combine factual observations
        all_observations = liquidity_observations + whale_observations

        # 6. Infer Probabilistic Participant Archetype and State
        (
            behavior_state,
            confidence,
            primary_participant,
            participant_breakdown,
            summary,
        ) = ParticipantModel.infer_behavior(
            snapshot=snapshot,
            liquidity=liquidity_pressure,
            whale=whale_activity,
            observations=all_observations,
        )

        return BehaviorAnalysisResult(
            symbol=clean_symbol,
            timestamp=snapshot.timestamp,
            behavior_state=behavior_state,
            confidence=confidence,
            primary_participant=primary_participant,
            summary=summary,
            observations=all_observations,
            participant_breakdown=participant_breakdown,
            liquidity_pressure=liquidity_pressure,
            whale_activity=whale_activity,
            timeframe=timeframe,
            model_version="v1.0",
        )


# Singleton instance
_behavior_model_service_instance: Optional[BehaviorModelService] = None


def get_behavior_service(
    market_data_service: MarketDataService = Depends(get_market_data_service),
) -> BehaviorModelService:
    """Factory dependency providing BehaviorModelService singleton."""
    global _behavior_model_service_instance
    if _behavior_model_service_instance is None:
        _behavior_model_service_instance = BehaviorModelService(market_data_service=market_data_service)
    return _behavior_model_service_instance
