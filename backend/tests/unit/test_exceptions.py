"""Unit tests for exception hierarchy and error payloads."""

from app.core.exceptions import (
    GHOSTException,
    NotFoundException,
    ProviderException,
    RateLimitException,
    ServiceUnavailableException,
    ValidationException,
    _build_error_payload,
)


def test_ghost_exception_defaults() -> None:
    """Verify base GHOSTException attributes."""
    exc = GHOSTException(message="Sample error")
    assert exc.message == "Sample error"
    assert exc.code == "BAD_REQUEST"
    assert exc.status_code == 400
    assert exc.details is None


def test_specialized_exceptions() -> None:
    """Verify subclassed exceptions carry appropriate codes and HTTP statuses."""
    not_found = NotFoundException("Asset not found")
    assert not_found.status_code == 404
    assert not_found.code == "NOT_FOUND"

    validation = ValidationException("Invalid allocation", details={"asset": "BTC"})
    assert validation.status_code == 422
    assert validation.code == "VALIDATION_ERROR"
    assert validation.details == {"asset": "BTC"}

    rate_limit = RateLimitException()
    assert rate_limit.status_code == 429
    assert rate_limit.code == "RATE_LIMIT_EXCEEDED"

    provider = ProviderException("Binance timeout")
    assert provider.status_code == 502
    assert provider.code == "PROVIDER_ERROR"

    unavailable = ServiceUnavailableException()
    assert unavailable.status_code == 503
    assert unavailable.code == "SERVICE_UNAVAILABLE"


def test_build_error_payload() -> None:
    """Verify error payload format conforms strictly to API response standard."""
    payload = _build_error_payload(
        code="TEST_CODE",
        message="Test error description",
        details={"key": "val"},
        request_id="req-12345",
    )
    assert payload["success"] is False
    assert payload["request_id"] == "req-12345"
    assert payload["error"]["code"] == "TEST_CODE"
    assert payload["error"]["message"] == "Test error description"
    assert payload["error"]["details"] == {"key": "val"}
