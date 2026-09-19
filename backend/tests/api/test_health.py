"""API tests for health check endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_health(async_client: AsyncClient) -> None:
    """Verify root GET /health endpoint satisfies specification."""
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "GHOST"
    assert data["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_api_v1_health(async_client: AsyncClient) -> None:
    """Verify versioned GET /api/v1/health endpoint satisfies standard envelope."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()

    # Envelope validation
    assert body["success"] is True
    assert "data" in body
    assert "metadata" in body

    # Payload validation
    health_data = body["data"]
    assert health_data["status"] == "healthy"
    assert health_data["service"] == "GHOST"
    assert health_data["version"] == "0.1.0"
    assert "timestamp" in health_data
    assert "environment" in health_data

    # Metadata validation
    assert "request_id" in body["metadata"]
    assert len(body["metadata"]["request_id"]) > 0


@pytest.mark.asyncio
async def test_root_discovery(async_client: AsyncClient) -> None:
    """Verify root GET / endpoint returns service discovery information."""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["service"] == "GHOST"
    assert data["docs_url"] == "/docs"
    assert data["api_v1"] == "/api/v1"


@pytest.mark.asyncio
async def test_openapi_docs(async_client: AsyncClient) -> None:
    """Verify OpenAPI JSON specification is generated correctly."""
    response = await async_client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "openapi" in schema
    assert schema["info"]["version"] == "0.1.0"
    assert "/health" in schema["paths"]
    assert "/api/v1/health" in schema["paths"]
