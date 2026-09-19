"""Quantitative Signal Engine package."""

from app.services.signal_engine.aggregator import SignalAggregator
from app.services.signal_engine.base import BaseStrategy
from app.services.signal_engine.mean_reversion import MeanReversionStrategy
from app.services.signal_engine.ml_signal import MultiFactorMLStrategy
from app.services.signal_engine.momentum import MomentumStrategy
from app.services.signal_engine.service import (
    SignalService,
    get_signal_service,
)
from app.services.signal_engine.technical import TechnicalStrategy
from app.services.signal_engine.volatility import VolatilityStrategy

__all__ = [
    "BaseStrategy",
    "TechnicalStrategy",
    "MomentumStrategy",
    "MeanReversionStrategy",
    "VolatilityStrategy",
    "MultiFactorMLStrategy",
    "SignalAggregator",
    "SignalService",
    "get_signal_service",
]
