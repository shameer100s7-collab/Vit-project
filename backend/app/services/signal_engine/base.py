"""Base interface and abstraction for quantitative trading strategies."""

from abc import ABC, abstractmethod
from typing import Optional

from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import MarketStateResult
from app.schemas.signals import StrategySignal


class BaseStrategy(ABC):
    """Abstract base class for all quantitative signal generation strategies."""

    def __init__(self, name: str, weight: float = 1.0) -> None:
        self.name = name
        self.weight = weight

    @abstractmethod
    def generate_signal(
        self,
        snapshot: FeatureSnapshot,
        market_state: Optional[MarketStateResult] = None,
    ) -> StrategySignal:
        """Generates a structured quantitative signal based on feature snapshot and regime context.

        Args:
            snapshot: Point-in-time quantitative feature values.
            market_state: Optional market regime classification from MarketStateService.

        Returns:
            StrategySignal with direction, bounded confidence, strength, time horizon, and reasons.
        """
        pass
