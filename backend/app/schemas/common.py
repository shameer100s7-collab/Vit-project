"""Common schemas for standard API request and response structures."""

from datetime import datetime, timezone
from typing import Any, Dict, Generic, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    """Detailed error object."""
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error description")
    details: Optional[Any] = Field(default=None, description="Optional diagnostic details or validation errors")


class StandardErrorResponse(BaseModel):
    """Standardized error envelope across all GHOST API endpoints."""
    success: bool = Field(default=False, description="Always false for error responses")
    error: ErrorDetail = Field(..., description="Error payload")
    request_id: str = Field(..., description="Correlated request identifier")


class StandardSuccessResponse(BaseModel, Generic[T]):
    """Standardized success envelope across all GHOST API endpoints."""
    success: bool = Field(default=True, description="Always true for success responses")
    data: T = Field(..., description="Primary response data payload")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Analytical, pagination, or execution metadata")


class HealthResponse(BaseModel):
    """Health check payload."""
    status: str = Field(default="healthy", description="Operational status")
    service: str = Field(default="GHOST", description="Service identifier")
    version: str = Field(default="0.1.0", description="Semantic service version")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="UTC timestamp of the health check",
    )
    environment: Optional[str] = Field(default="development", description="Current operating environment")
    database: Optional[str] = Field(default=None, description="Database connection status")
