"""Cryptographic and security utilities for password hashing and JWT lifecycle."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Set, Union
import jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.exceptions import UnauthorizedException

# Password hashing context using Argon2id
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

ALGORITHM = "HS256"


class TokenBlocklist:
    """In-memory token revocation store with Redis-ready interface."""

    def __init__(self) -> None:
        self._revoked_jtis: Set[str] = set()

    def revoke(self, jti: str) -> None:
        """Revokes a specific token by its unique JWT identifier (jti)."""
        self._revoked_jtis.add(jti)

    def is_revoked(self, jti: str) -> bool:
        """Checks if the given token JTI has been revoked."""
        return jti in self._revoked_jtis


token_blocklist = TokenBlocklist()


def hash_password(password: str) -> str:
    """Computes secure Argon2id hash of a plaintext password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against an Argon2id hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    subject: Union[str, Any],
    role: str = "USER",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Creates a signed JSON Web Token for user authorization."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": str(subject),
        "role": str(role),
        "type": "access",
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Creates a signed refresh token for session maintenance."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    payload: Dict[str, Any] = {
        "sub": str(subject),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Decodes and validates signature and expiration of a JWT."""
    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[ALGORITHM],
        )
        jti = payload.get("jti")
        if jti and token_blocklist.is_revoked(jti):
            raise UnauthorizedException("Token has been revoked or session invalidated")
        return payload
    except jwt.ExpiredSignatureError:
        raise UnauthorizedException("Authentication token has expired")
    except jwt.InvalidTokenError:
        raise UnauthorizedException("Invalid authentication token")
