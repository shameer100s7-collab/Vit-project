"""Database seed logic for GHOST development and test environment."""

from app.core.logging import get_logger
from app.core.security import hash_password
from app.db.database import async_session_factory
from app.db.models.user import User, UserRole
from app.db.repositories.user import UserRepository

logger = get_logger("ghost.seed")


async def seed_development_user() -> None:
    """Seeds or updates the standard development test user account."""
    async with async_session_factory() as session:
        try:
            user_repo = UserRepository(session)
            test_username = "test"
            test_password = "12345678"

            existing_user = await user_repo.get_by_email(test_username)
            if existing_user:
                logger.info("Test user '%s' already exists. Synchronizing password hash...", test_username)
                existing_user.hashed_password = hash_password(test_password)
                existing_user.is_active = True
                await session.commit()
                logger.info("Test user '%s' updated successfully.", test_username)
            else:
                logger.info("Creating default development test user '%s'...", test_username)
                await user_repo.create(
                    email=test_username,
                    hashed_password=hash_password(test_password),
                    full_name="GHOST Development Operator",
                    role=UserRole.ADMIN,
                    is_active=True,
                    is_verified=True,
                )
                await session.commit()
                logger.info("Test user '%s' created successfully.", test_username)
        except Exception as exc:
            logger.warning("Failed to seed development test user: %s", exc)
            await session.rollback()
