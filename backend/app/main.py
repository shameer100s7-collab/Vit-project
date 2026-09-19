"""Main FastAPI application entrypoint for GHOST."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Dict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.core.middleware import RequestCorrelationMiddleware

# Initialize logging system
setup_logging(log_level=settings.LOG_LEVEL, log_format=settings.LOG_FORMAT)
logger = get_logger("ghost.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan management for initialization and clean shutdown."""
    logger.info(
        "Starting %s v%s in [%s] environment...",
        settings.PROJECT_NAME,
        settings.VERSION,
        settings.ENV,
    )
    yield
    logger.info("Shutting down %s...", settings.PROJECT_NAME)


def create_application() -> FastAPI:
    """Application factory for GHOST FastAPI service."""
    app = FastAPI(
        title=f"{settings.PROJECT_NAME} - Quantitative Intelligence Platform",
        description=settings.DESCRIPTION,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # 1. Register security & correlation middlewares (LIFO execution order in Starlette)
    app.add_middleware(RequestCorrelationMiddleware)

    # 2. Configure Cross-Origin Resource Sharing (CORS)
    if settings.CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # 3. Register global exception handlers
    register_exception_handlers(app)

    # 4. Root Health Probe (Matches prompt requirement)
    @app.get(
        "/health",
        tags=["Health"],
        summary="Service Health Probe",
        description="Returns basic health status of the GHOST backend instance.",
    )
    async def root_health() -> Dict[str, str]:
        return {
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
        }

    # 5. Root Service Information
    @app.get(
        "/",
        tags=["Root"],
        summary="Service Discovery",
        description="Returns basic service metadata and documentation links.",
    )
    async def root() -> Dict[str, str]:
        return {
            "status": "online",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "docs_url": "/docs",
            "api_v1": settings.API_V1_STR,
        }

    # 6. Mount Versioned API Routes (/api/v1)
    app.include_router(api_v1_router, prefix=settings.API_V1_STR)

    return app


app = create_application()
