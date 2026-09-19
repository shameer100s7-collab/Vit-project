"""Common dependency injection providers."""

from fastapi import Request
from app.core.config import Settings, settings


def get_settings() -> Settings:
    """Provides application settings dependency."""
    return settings


def get_request_id(request: Request) -> str:
    """Retrieves current request ID from request state."""
    return getattr(request.state, "request_id", "-")
