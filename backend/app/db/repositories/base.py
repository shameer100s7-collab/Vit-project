"""Base generic asynchronous repository providing standard CRUD operations."""

from typing import Any, Generic, List, Optional, Type, TypeVar, Union
from uuid import UUID
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Generic asynchronous repository for clean database access."""

    def __init__(self, model: Type[ModelType], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def get_by_id(self, id: Union[UUID, str]) -> Optional[ModelType]:
        """Fetches a single entity by its primary key ID."""
        if isinstance(id, str):
            try:
                id = UUID(id)
            except ValueError:
                return None
        result = await self.session.get(self.model, id)
        return result

    async def list(
        self,
        offset: int = 0,
        limit: int = 100,
    ) -> List[ModelType]:
        """Retrieves a paginated list of entities."""
        query = select(self.model).offset(offset).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create(self, **attributes: Any) -> ModelType:
        """Instantiates, persists, and flushes a new model record."""
        instance = self.model(**attributes)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def update(self, instance: ModelType, **attributes: Any) -> ModelType:
        """Updates attributes on an existing model record."""
        for key, value in attributes.items():
            if hasattr(instance, key):
                setattr(instance, key, value)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def delete(self, instance: ModelType) -> None:
        """Deletes an entity from persistence."""
        await self.session.delete(instance)
        await self.session.flush()

    async def count(self) -> int:
        """Returns the total number of records for this entity."""
        query = select(func.count()).select_from(self.model)
        result = await self.session.execute(query)
        return int(result.scalar_one() or 0)
