"""API v1 master router incorporating all sub-modules."""

from fastapi import APIRouter
from app.api.v1.routes import auth, behavior, courtroom, health, intelligence, market, portfolio, risk, signals, strategies

api_v1_router = APIRouter()

# Health & Observability routes
api_v1_router.include_router(health.router, tags=["Health"])

# Authentication & Identity routes
api_v1_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Portfolio & Wallet routes
api_v1_router.include_router(portfolio.router, prefix="/portfolio", tags=["Portfolio"])

# Market Data Engine routes
api_v1_router.include_router(market.router, prefix="/market", tags=["Market Data"])

# Market State Intelligence Engine routes
api_v1_router.include_router(intelligence.router, prefix="/intelligence", tags=["Intelligence"])

# Quantitative Signal Engine routes
api_v1_router.include_router(signals.router, prefix="/signals", tags=["Signals"])

# Observable Behavior Model routes
api_v1_router.include_router(behavior.router, prefix="/behavior", tags=["Behavior"])

# Quantitative Risk Engine routes
api_v1_router.include_router(risk.router, prefix="/risk", tags=["Risk"])

# Adversarial Courtroom routes
api_v1_router.include_router(courtroom.router, prefix="/courtroom", tags=["Courtroom"])

# Real-time On-Chain + AI-Verified Strategy Platform routes
api_v1_router.include_router(strategies.router, prefix="/strategies", tags=["Strategies"])




