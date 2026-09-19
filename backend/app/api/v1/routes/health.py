"""Health check endpoints for system observability and readiness probes."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_request_id, get_settings
from app.core.config import Settings
from app.db.database import check_db_health, get_db
from app.schemas.common import HealthResponse, StandardSuccessResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=StandardSuccessResponse[HealthResponse],
    summary="API v1 Health Probe",
    description="Returns detailed operational health status of the GHOST API v1 subsystem and database connectivity.",
)
async def api_health(
    settings: Settings = Depends(get_settings),
    request_id: str = Depends(get_request_id),
    session: AsyncSession = Depends(get_db),
) -> StandardSuccessResponse[HealthResponse]:
    """Returns structured API health, environment status, and database probe."""
    db_alive = await check_db_health(session)
    db_status = "connected" if db_alive else "disconnected"

    health_data = HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=settings.ENV,
        database=db_status,
    )
    return StandardSuccessResponse(
        success=True,
        data=health_data,
        metadata={
            "request_id": request_id,
        },
    )
