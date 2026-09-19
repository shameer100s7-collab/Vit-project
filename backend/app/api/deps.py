"""Common dependency injection providers including auth and RBAC."""

from typing import Callable, Optional
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, settings
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_token
from app.db.database import get_db
from app.db.models.user import User, UserRole
from app.db.repositories.user import UserRepository

# OAuth2 scheme extracting Bearer token from Authorization header
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)


def get_settings() -> Settings:
    """Provides application settings dependency."""
    return settings


def get_request_id(request: Request) -> str:
    """Retrieves current request ID from request state."""
    return getattr(request.state, "request_id", "-")


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Extracts, verifies JWT access token, and resolves the User record."""
    if not token:
        raise UnauthorizedException("Authentication credentials were not provided")

    payload = decode_token(token)
    token_type = payload.get("type")
    if token_type != "access":
        raise UnauthorizedException(f"Invalid token type: expected access token, got {token_type}")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Malformed token subject")

    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if not user:
        raise UnauthorizedException("User account no longer exists")

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensures authenticated user account is active."""
    if not current_user.is_active:
        raise ForbiddenException("User account is inactive or disabled")
    return current_user


def require_role(*required_roles: UserRole) -> Callable[[User], User]:
    """Factory returning a dependency that enforces required user role(s)."""
    async def role_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.role not in required_roles:
            role_names = [r.value for r in required_roles]
            raise ForbiddenException(
                f"Insufficient permissions: requires one of roles {role_names}",
            )
        return current_user

    return role_checker
