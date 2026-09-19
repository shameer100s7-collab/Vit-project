"""Custom application exceptions and global FastAPI exception handlers."""

import logging
from typing import Any, Dict, Optional
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger, request_id_ctx_var

logger = get_logger("ghost.exceptions")


class GHOSTException(Exception):
    """Base application exception for all GHOST errors."""

    def __init__(
        self,
        message: str,
        code: str = "BAD_REQUEST",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class NotFoundException(GHOSTException):
    """Resource not found error."""

    def __init__(self, message: str = "Resource not found", details: Optional[Any] = None) -> None:
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
        )


class ValidationException(GHOSTException):
    """Business rule or input validation error."""

    def __init__(self, message: str = "Validation error", details: Optional[Any] = None) -> None:
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class UnauthorizedException(GHOSTException):
    """Authentication failed error."""

    def __init__(self, message: str = "Authentication required", details: Optional[Any] = None) -> None:
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
        )


class ForbiddenException(GHOSTException):
    """Access denied error."""

    def __init__(self, message: str = "Access forbidden", details: Optional[Any] = None) -> None:
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
        )


class RateLimitException(GHOSTException):
    """Rate limit exceeded error."""

    def __init__(self, message: str = "Rate limit exceeded", details: Optional[Any] = None) -> None:
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=details,
        )


class ProviderException(GHOSTException):
    """External data or model provider failure."""

    def __init__(self, message: str = "Market provider failure", details: Optional[Any] = None) -> None:
        super().__init__(
            message=message,
            code="PROVIDER_ERROR",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details=details,
        )


class ServiceUnavailableException(GHOSTException):
    """Temporary service unavailability error."""

    def __init__(self, message: str = "Service temporarily unavailable", details: Optional[Any] = None) -> None:
        super().__init__(
            message=message,
            code="SERVICE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=details,
        )


def _build_error_payload(code: str, message: str, details: Optional[Any], request_id: str) -> Dict[str, Any]:
    """Formats standardized error payload."""
    payload: Dict[str, Any] = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
        },
        "request_id": request_id,
    }
    if details is not None:
        payload["error"]["details"] = details
    return payload


def register_exception_handlers(app: FastAPI) -> None:
    """Registers standard exception handlers on the FastAPI application."""

    @app.exception_handler(GHOSTException)
    async def ghost_exception_handler(request: Request, exc: GHOSTException) -> JSONResponse:
        req_id = request_id_ctx_var.get()
        logger.warning(
            "GHOSTException: code=%s, status=%d, message=%s, path=%s",
            exc.code,
            exc.status_code,
            exc.message,
            request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=_build_error_payload(exc.code, exc.message, exc.details, req_id),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        req_id = request_id_ctx_var.get()
        logger.info(
            "RequestValidationError: path=%s, errors=%s",
            request.url.path,
            exc.errors(),
        )
        # Sanitize error representations
        errors = [
            {
                "field": " -> ".join(str(loc) for loc in err.get("loc", [])),
                "message": err.get("msg"),
                "type": err.get("type"),
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_build_error_payload(
                "VALIDATION_ERROR",
                "The submitted request payload failed validation.",
                errors,
                req_id,
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        req_id = request_id_ctx_var.get()
        logger.warning("HTTPException: status=%d, detail=%s, path=%s", exc.status_code, exc.detail, request.url.path)
        code = "HTTP_ERROR"
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            code = "NOT_FOUND"
        elif exc.status_code == status.HTTP_401_UNAUTHORIZED:
            code = "UNAUTHORIZED"
        elif exc.status_code == status.HTTP_403_FORBIDDEN:
            code = "FORBIDDEN"
        elif exc.status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
            code = "METHOD_NOT_ALLOWED"
        return JSONResponse(
            status_code=exc.status_code,
            content=_build_error_payload(code, str(exc.detail), None, req_id),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        req_id = request_id_ctx_var.get()
        logger.error(
            "Unhandled exception on %s %s: %s",
            request.method,
            request.url.path,
            str(exc),
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_build_error_payload(
                "INTERNAL_SERVER_ERROR",
                "An unexpected internal error occurred. Please reference request_id for support.",
                None,
                req_id,
            ),
        )
