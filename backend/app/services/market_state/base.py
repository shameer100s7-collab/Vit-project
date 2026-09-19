"""Base interface for quantitative market regime classifiers."""

from abc import ABC, abstractmethod

from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import MarketStateResult


class MarketStateClassifier(ABC):
    """Abstract interface defining the contract for market regime classification."""

    @abstractmethod
    def classify(self, snapshot: FeatureSnapshot, timeframe: str = "1h") -> MarketStateResult:
        """Evaluates a quantitative feature snapshot and returns a classified market regime.

        Args:
            snapshot: Point-in-time quantitative indicator features.
            timeframe: Candle interval timeframe used for indicator calculations.

        Returns:
            MarketStateResult with classified state, bounded confidence, evidence, and scores.
        """
        pass
