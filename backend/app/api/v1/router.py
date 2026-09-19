"""API v1 master router incorporating all sub-modules."""

from fastapi import APIRouter
from app.api.v1.routes import auth, health, intelligence, market

api_v1_router = APIRouter()

# Health & Observability routes
api_v1_router.include_router(health.router, tags=["Health"])

# Authentication & Identity routes
api_v1_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Market Data Engine routes
api_v1_router.include_router(market.router, prefix="/market", tags=["Market Data"])

# Market State Intelligence Engine routes
api_v1_router.include_router(intelligence.router, prefix="/intelligence", tags=["Intelligence"])
