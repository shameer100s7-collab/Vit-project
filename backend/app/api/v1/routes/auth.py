"""Authentication and identity endpoints."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_active_user,
    get_current_user,
    get_request_id,
    get_settings,
    oauth2_scheme,
)
from app.core.config import Settings
from app.core.exceptions import (
    ForbiddenException,
    GHOSTException,
    UnauthorizedException,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    token_blocklist,
    verify_password,
)
from app.db.database import get_db
from app.db.models.user import User, UserRole
from app.db.repositories.audit import AuditLogRepository
from app.db.repositories.user import UserRepository
from app.schemas.auth import (
    RefreshTokenRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.schemas.common import StandardSuccessResponse

router = APIRouter()


@router.post(
    "/register",
    response_model=StandardSuccessResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="User Registration",
    description="Registers a new user account with secure Argon2 password hashing.",
)
async def register_user(
    payload: UserRegisterRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[UserResponse]:
    """Handles new user onboarding and audit log registration."""
    user_repo = UserRepository(session)
    audit_repo = AuditLogRepository(session)

    # Validate email uniqueness
    existing = await user_repo.get_by_email(payload.email)
    if existing:
        raise GHOSTException(
            message="An account with this email address already exists.",
            code="EMAIL_ALREADY_EXISTS",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Securely hash password
    hashed_pwd = hash_password(payload.password)

    # Persist user record
    new_user = await user_repo.create(
        email=payload.email.lower().strip(),
        hashed_password=hashed_pwd,
        full_name=payload.full_name,
        role=payload.role or UserRole.USER,
        is_active=True,
        is_verified=False,
    )

    # Log security audit entry
    await audit_repo.log(
        action="USER_REGISTRATION",
        entity_type="USER",
        entity_id=str(new_user.id),
        user_id=new_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"email": new_user.email, "role": new_user.role.value},
    )

    return StandardSuccessResponse(
        success=True,
        data=UserResponse.model_validate(new_user),
        metadata={"request_id": request_id},
    )


@router.post(
    "/login",
    response_model=StandardSuccessResponse[TokenResponse],
    summary="User Login",
    description="Authenticates user credentials and issues JWT access and refresh tokens.",
)
async def login_user(
    payload: UserLoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[TokenResponse]:
    """Authenticates credentials, generates JWT pair, and records audit trail."""
    user_repo = UserRepository(session)
    audit_repo = AuditLogRepository(session)

    user = await user_repo.get_by_email(payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise UnauthorizedException("Invalid email or password.")

    if not user.is_active:
        raise ForbiddenException("User account is inactive or disabled.")

    # Generate JWT token pair
    access_token = create_access_token(subject=user.id, role=user.role.value)
    refresh_token = create_refresh_token(subject=user.id)

    # Audit login success
    await audit_repo.log(
        action="USER_LOGIN_SUCCESS",
        entity_type="USER",
        entity_id=str(user.id),
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    token_payload = TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return StandardSuccessResponse(
        success=True,
        data=token_payload,
        metadata={"request_id": request_id},
    )


@router.post(
    "/refresh",
    response_model=StandardSuccessResponse[TokenResponse],
    summary="Token Refresh",
    description="Rotates refresh token and issues a new access token.",
)
async def refresh_access_token(
    payload: RefreshTokenRequest,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[TokenResponse]:
    """Validates refresh token and rotates token pair."""
    token_data = decode_token(payload.refresh_token)
    if token_data.get("type") != "refresh":
        raise UnauthorizedException("Invalid token type: refresh token expected.")

    user_id = token_data.get("sub")
    user_repo = UserRepository(session)
    user = await user_repo.get_by_id(user_id)
    if not user or not user.is_active:
        raise UnauthorizedException("User account is invalid or inactive.")

    # Invalidate previous refresh token JTI
    old_jti = token_data.get("jti")
    if old_jti:
        token_blocklist.revoke(old_jti)

    # Issue renewed token pair
    new_access_token = create_access_token(subject=user.id, role=user.role.value)
    new_refresh_token = create_refresh_token(subject=user.id)

    token_payload = TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return StandardSuccessResponse(
        success=True,
        data=token_payload,
        metadata={"request_id": request_id},
    )


@router.post(
    "/logout",
    response_model=StandardSuccessResponse[Dict[str, str]],
    summary="User Logout",
    description="Invalidates current session token and adds it to the token revocation blocklist.",
)
async def logout_user(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[Dict[str, str]]:
    """Revokes active token and logs out."""
    if token:
        try:
            payload = decode_token(token)
            jti = payload.get("jti")
            if jti:
                token_blocklist.revoke(jti)
        except Exception:
            pass

    return StandardSuccessResponse(
        success=True,
        data={"message": "Logged out successfully."},
        metadata={"request_id": request_id},
    )


@router.get(
    "/me",
    response_model=StandardSuccessResponse[UserResponse],
    summary="Current User Profile",
    description="Returns the profile information of the currently authenticated user.",
)
async def get_me(
    current_user: User = Depends(get_current_active_user),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[UserResponse]:
    """Returns authenticated profile."""
    return StandardSuccessResponse(
        success=True,
        data=UserResponse.model_validate(current_user),
        metadata={"request_id": request_id},
    )
