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
]
