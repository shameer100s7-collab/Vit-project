"""API tests for middleware and global error handling."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_request_id_generated_when_missing(async_client: AsyncClient) -> None:
    """Verify X-Request-ID is automatically generated when not supplied by client."""
    response = await async_client.get("/health")
    assert response.status_code == 200
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    assert len(req_id) >= 10


@pytest.mark.asyncio
async def test_request_id_preserved_when_supplied(async_client: AsyncClient) -> None:
    """Verify client supplied X-Request-ID is preserved in downstream execution."""
    custom_id = "test-custom-request-id-9988"
    response = await async_client.get("/health", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == custom_id


@pytest.mark.asyncio
async def test_process_time_and_security_headers(async_client: AsyncClient) -> None:
    """Verify security headers and process time latency headers are attached."""
    response = await async_client.get("/health")
    assert "X-Process-Time-Ms" in response.headers
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"


@pytest.mark.asyncio
async def test_standard_404_error_envelope(async_client: AsyncClient) -> None:
    """Verify non-existent routes return standardized JSON error envelope."""
    response = await async_client.get("/api/v1/non-existent-endpoint")
    assert response.status_code == 404
    body = response.json()

    assert body["success"] is False
    assert "error" in body
    assert body["error"]["code"] == "NOT_FOUND"
    assert "request_id" in body
    assert body["request_id"] == response.headers.get("X-Request-ID")
