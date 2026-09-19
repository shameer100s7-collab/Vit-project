"""Pydantic request and response schemas for authentication and authorization."""

import uuid
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, EmailStr, Field, model_validator

from app.db.models.user import UserRole


class UserRegisterRequest(BaseModel):
    """Payload for user registration."""
    email: str = Field(..., description="Unique email address or username")
    password: str = Field(..., min_length=8, description="Password must contain at least 8 characters")
    full_name: Optional[str] = Field(default=None, max_length=255, description="Full name or pseudonym")
    role: Optional[UserRole] = Field(default=UserRole.USER, description="Initial requested account role")


class UserLoginRequest(BaseModel):
    """Payload for user login."""
    email: Optional[str] = Field(default=None, description="Registered email address or username")
    username: Optional[str] = Field(default=None, description="Username for login")
    password: str = Field(..., description="Plaintext password")

    @model_validator(mode="before")
    @classmethod
    def resolve_username_or_email(cls, data: Any) -> Any:
        if isinstance(data, dict):
            identifier = data.get("username") or data.get("email")
            if identifier:
                data["email"] = identifier
                data["username"] = identifier
        return data

class RefreshTokenRequest(BaseModel):
    """Payload for requesting new access token using refresh token."""
    refresh_token: str = Field(..., description="Active refresh token")


class TokenResponse(BaseModel):
    """Bearer token authorization response."""
    access_token: str = Field(..., description="Short-lived JWT access token")
    refresh_token: str = Field(..., description="Long-lived JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type specification")
    expires_in: int = Field(..., description="Access token expiration window in seconds")


class UserResponse(BaseModel):
    """User profile data model."""
    id: uuid.UUID = Field(..., description="Unique user identifier")
    email: str = Field(..., description="Email address")
    full_name: Optional[str] = Field(default=None, description="User full name")
    role: UserRole = Field(..., description="Account authorization role")
    is_active: bool = Field(..., description="Whether user account is active")
    is_verified: bool = Field(..., description="Whether user email is verified")
    created_at: datetime = Field(..., description="Account creation timestamp")

    model_config = {"from_attributes": True}
