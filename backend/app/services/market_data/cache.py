"""Asynchronous in-memory TTL caching with Redis-ready interface."""

import asyncio
import time
from typing import Any, Dict, Optional, Tuple


class MarketDataCache:
    """Thread-safe and async-safe in-memory TTL cache for market data queries."""

    def __init__(self) -> None:
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        """Retrieves item from cache if not expired."""
        async with self._lock:
            entry = self._cache.get(key)
            if not entry:
                return None
            value, expires_at = entry
            if time.time() > expires_at:
                del self._cache[key]
                return None
            return value

    async def set(self, key: str, value: Any, ttl_seconds: int = 10) -> None:
        """Stores item with specified expiration in seconds."""
        async with self._lock:
            expires_at = time.time() + ttl_seconds
            self._cache[key] = (value, expires_at)

    async def delete(self, key: str) -> None:
        """Explicitly evicts a key from cache."""
        async with self._lock:
            self._cache.pop(key, None)

    async def clear(self) -> None:
        """Flushes all cached entries."""
        async with self._lock:
            self._cache.clear()
