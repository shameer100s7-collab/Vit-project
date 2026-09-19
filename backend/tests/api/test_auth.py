"""API tests for user registration, authentication, token refresh, and profile endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_user_success(async_client: AsyncClient) -> None:
    """Verify successful user registration returns 201 Created and standard envelope."""
    payload = {
        "email": "crypto_trader@ghost.io",
        "password": "SuperSecretPassword123!",
        "full_name": "Satoshi Quant",
        "role": "USER",
    }
    response = await async_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    body = response.json()

    assert body["success"] is True
    assert "data" in body
    data = body["data"]
    assert data["email"] == "crypto_trader@ghost.io"
    assert data["full_name"] == "Satoshi Quant"
    assert data["role"] == "USER"
    assert data["is_active"] is True
    assert "id" in data
    # Ensure password hash is never exposed in response
    assert "hashed_password" not in data
    assert "password" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email(async_client: AsyncClient) -> None:
    """Verify duplicate email registration is rejected with 400 Bad Request."""
    payload = {
        "email": "duplicate@ghost.io",
        "password": "Password12345!",
    }
    # First registration
    res1 = await async_client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Second registration with same email
    res2 = await async_client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 400
    body = res2.json()
    assert body["success"] is False
    assert body["error"]["code"] == "EMAIL_ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_register_short_password_validation(async_client: AsyncClient) -> None:
    """Verify registration fails validation if password length is under 8 characters."""
    payload = {
        "email": "short_pw@ghost.io",
        "password": "short",
    }
    response = await async_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_login_success_and_token_issuance(async_client: AsyncClient) -> None:
    """Verify valid login returns access and refresh JWT tokens."""
    # 1. Register
    reg_payload = {
        "email": "login_user@ghost.io",
        "password": "ValidLoginPassword123!",
    }
    await async_client.post("/api/v1/auth/register", json=reg_payload)

    # 2. Login
    login_payload = {
        "email": "login_user@ghost.io",
        "password": "ValidLoginPassword123!",
    }
    response = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    data = body["data"]
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


@pytest.mark.asyncio
async def test_login_invalid_password(async_client: AsyncClient) -> None:
    """Verify login with incorrect password returns 401 Unauthorized."""
    reg_payload = {
        "email": "victim@ghost.io",
        "password": "CorrectPassword123!",
    }
    await async_client.post("/api/v1/auth/register", json=reg_payload)

    login_payload = {
        "email": "victim@ghost.io",
        "password": "IncorrectPassword999!",
    }
    response = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_get_me_unauthorized_when_missing_token(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/auth/me rejects unauthenticated requests."""
    response = await async_client.get("/api/v1/auth/me")
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_get_me_authorized(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/auth/me returns authenticated user details when token is valid."""
    email = "profile_user@ghost.io"
    password = "MyPassword12345!"

    await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Profile Owner"},
    )
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    access_token = login_res.json()["data"]["access_token"]

    response = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["email"] == email
    assert body["data"]["full_name"] == "Profile Owner"


@pytest.mark.asyncio
async def test_refresh_token_rotation(async_client: AsyncClient) -> None:
    """Verify token rotation via POST /api/v1/auth/refresh."""
    email = "refresh_user@ghost.io"
    password = "RefreshPassword123!"

    await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    refresh_token = login_res.json()["data"]["refresh_token"]

    # Request new token pair
    refresh_res = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_res.status_code == 200
    body = refresh_res.json()
    assert body["success"] is True
    assert "access_token" in body["data"]
    assert "refresh_token" in body["data"]
    assert body["data"]["refresh_token"] != refresh_token


@pytest.mark.asyncio
async def test_logout_and_revocation(async_client: AsyncClient) -> None:
    """Verify POST /api/v1/auth/logout invalidates the current session token."""
    email = "logout_user@ghost.io"
    password = "LogoutPassword123!"

    await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    access_token = login_res.json()["data"]["access_token"]

    # Logout
    logout_res = await async_client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert logout_res.status_code == 200

    # Attempt to access protected route with revoked token
    me_res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_res.status_code == 401
    assert "revoked" in me_res.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_rbac_role_enforcement() -> None:
    """Verify require_role permits authorized roles and forbids unauthorized roles."""
    from app.api.deps import require_role
    from app.core.exceptions import ForbiddenException
    from app.db.models.user import User, UserRole

    analyst_user = User(
        email="analyst@ghost.io",
        hashed_password="hash",
        role=UserRole.ANALYST,
        is_active=True,
    )
    regular_user = User(
        email="user@ghost.io",
        hashed_password="hash",
        role=UserRole.USER,
        is_active=True,
    )

    admin_or_analyst_checker = require_role(UserRole.ANALYST, UserRole.ADMIN)

    # Permitted role passes
    allowed = await admin_or_analyst_checker(current_user=analyst_user)
    assert allowed.email == "analyst@ghost.io"

    # Forbidden role raises 403 ForbiddenException
    with pytest.raises(ForbiddenException) as exc_info:
        await admin_or_analyst_checker(current_user=regular_user)
    assert "insufficient permissions" in str(exc_info.value.message).lower()
    assert exc_info.value.status_code == 403
