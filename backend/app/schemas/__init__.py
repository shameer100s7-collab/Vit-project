"""Schemas package exporting common and domain-specific schemas."""

from app.schemas.auth import (
    RefreshTokenRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.schemas.common import (
    ErrorDetail,
    HealthResponse,
    StandardErrorResponse,
    StandardSuccessResponse,
)
from app.schemas.market import (
    CanonicalAssetMetadata,
    CanonicalCandle,
    CanonicalMarketOverview,
    CanonicalMarketOverviewItem,
    CanonicalOrderBook,
    CanonicalPrice,
    CanonicalVolume,
    OrderBookLevel,
)
from app.schemas.market_state import (
    EvidenceItem,
    MarketState,
    MarketStateResult,
    MarketStateScores,
)
from app.schemas.signals import (
    AggregatedSignalResult,
    SignalDirection,
    SignalHistoryItem,
    StrategySignal,
    TimeHorizon,
)

__all__ = [
    "ErrorDetail",
    "HealthResponse",
    "StandardErrorResponse",
    "StandardSuccessResponse",
    "UserRegisterRequest",
    "UserLoginRequest",
    "RefreshTokenRequest",
    "TokenResponse",
    "UserResponse",
    "CanonicalPrice",
    "CanonicalCandle",
    "CanonicalOrderBook",
    "OrderBookLevel",
    "CanonicalVolume",
    "CanonicalAssetMetadata",
    "CanonicalMarketOverviewItem",
    "CanonicalMarketOverview",
    "MarketState",
    "EvidenceItem",
    "MarketStateScores",
    "MarketStateResult",
    "SignalDirection",
    "TimeHorizon",
    "StrategySignal",
    "AggregatedSignalResult",
    "SignalHistoryItem",
]
