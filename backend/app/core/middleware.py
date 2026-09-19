"""Application middlewares for request tracking, latency monitoring, and security."""

import time
import uuid
from typing import Awaitable, Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger, request_id_ctx_var

logger = get_logger("ghost.middleware")


class RequestCorrelationMiddleware(BaseHTTPMiddleware):
    """Middleware to inject/propagate request IDs, measure process time, and attach security headers."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        start_time = time.perf_counter()

        # Extract incoming X-Request-ID or generate new UUIDv4
        incoming_req_id = request.headers.get("X-Request-ID")
        request_id = incoming_req_id.strip() if incoming_req_id and incoming_req_id.strip() else str(uuid.uuid4())

        # Set context variable for structured logging throughout the request lifecycle
        token = request_id_ctx_var.set(request_id)
        request.state.request_id = request_id

        try:
            response = await call_next(request)
        finally:
            request_id_ctx_var.reset(token)

        duration_ms = (time.perf_counter() - start_time) * 1000.0

        # Inject tracing, timing, and baseline security headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"

        logger.info(
            "%s %s %d - %.2fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )

        return response
