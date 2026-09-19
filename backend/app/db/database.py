"""SQLAlchemy 2.x asynchronous database engine, sessionmaker, and Base."""

from typing import AsyncGenerator, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("ghost.database")


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy declarative models in GHOST."""
    pass


def get_engine() -> AsyncEngine:
    """Creates and returns the async SQLAlchemy engine."""
    database_url = settings.async_database_url
    connect_args = {}
    if "sqlite" in database_url:
        connect_args["check_same_thread"] = False

    return create_async_engine(
        database_url,
        echo=False,
        future=True,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


engine: AsyncEngine = get_engine()

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding transactional async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def check_db_health(session: Optional[AsyncSession] = None) -> bool:
    """Verifies database connectivity with lightweight ping query."""
    try:
        if session:
            await session.execute(text("SELECT 1"))
            return True
        async with async_session_factory() as local_session:
            await local_session.execute(text("SELECT 1"))
            return True
    except Exception as exc:
        logger.warning("Database health check failed: %s", exc)
        return False
