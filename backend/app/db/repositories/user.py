"""User repository for authentication and account queries."""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.db.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository managing User records."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> Optional[User]:
        """Finds a user by case-insensitive email address."""
        query = select(User).where(User.email == email.lower().strip())
        result = await self.session.execute(query)
        return result.scalars().first()
