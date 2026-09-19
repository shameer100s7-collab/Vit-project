"""Unit tests for cryptographic functions, password hashing, and JWT tokens."""

from datetime import timedelta
import pytest

from app.core.exceptions import UnauthorizedException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    token_blocklist,
    verify_password,
)


def test_password_hashing_and_verification() -> None:
    """Verify password hashing produces valid Argon2 hashes and verifies correctly."""
    pwd = "CorrectHorseBatteryStaple99!"
    hashed = hash_password(pwd)

    # Hash should be non-empty and different from plaintext
    assert hashed != pwd
    assert hashed.startswith("$argon2")

    # Correct password succeeds
    assert verify_password(pwd, hashed) is True

    # Incorrect password fails
    assert verify_password("WrongPassword123!", hashed) is False


def test_access_token_lifecycle() -> None:
    """Verify access token creation, subject encoding, and successful decode."""
    user_id = "d3b07384-d113-4672-b2d9-ecff92d13b48"
    token = create_access_token(subject=user_id, role="ANALYST")

    payload = decode_token(token)
    assert payload["sub"] == user_id
    assert payload["role"] == "ANALYST"
    assert payload["type"] == "access"
    assert "jti" in payload
    assert "exp" in payload


def test_refresh_token_lifecycle() -> None:
    """Verify refresh token creation and decode."""
    user_id = "d3b07384-d113-4672-b2d9-ecff92d13b48"
    token = create_refresh_token(subject=user_id)

    payload = decode_token(token)
    assert payload["sub"] == user_id
    assert payload["type"] == "refresh"


def test_expired_token_rejection() -> None:
    """Verify that an expired token raises UnauthorizedException."""
    token = create_access_token(
        subject="user-123",
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(UnauthorizedException) as exc_info:
        decode_token(token)
    assert "expired" in str(exc_info.value.message).lower()


def test_invalid_token_signature() -> None:
    """Verify corrupted or forged tokens raise UnauthorizedException."""
    with pytest.raises(UnauthorizedException):
        decode_token("header.payload.invalidsignaturehere")


def test_token_revocation_blocklist() -> None:
    """Verify revoked tokens cannot be decoded successfully."""
    token = create_access_token(subject="user-revoked")
    payload = decode_token(token)
    jti = payload["jti"]

    # Revoke JTI
    token_blocklist.revoke(jti)
    assert token_blocklist.is_revoked(jti) is True

    with pytest.raises(UnauthorizedException) as exc_info:
        decode_token(token)
    assert "revoked" in str(exc_info.value.message).lower()
