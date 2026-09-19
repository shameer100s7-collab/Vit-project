"""Health check endpoints for system observability and readiness probes."""

from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter, Depends
from app.api.deps import get_request_id, get_settings
from app.core.config import Settings
from app.schemas.common import HealthResponse, StandardSuccessResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=StandardSuccessResponse[HealthResponse],
    summary="API v1 Health Probe",
    description="Returns detailed operational health status of the GHOST API v1 subsystem.",
)
async def api_health(
    settings: Settings = Depends(get_settings),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[HealthResponse]:
    """Returns structured API health and environment status."""
    health_data = HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=settings.ENV,
    )
    return StandardSuccessResponse(
        success=True,
        data=health_data,
        metadata={
            "request_id": request_id,
        },
    )
