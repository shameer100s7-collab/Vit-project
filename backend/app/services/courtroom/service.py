"""Courtroom application service coordinating adversarial case processing and retrieval."""

import asyncio
from datetime import datetime, timezone
import random
import string
from typing import Dict, List, Optional

from app.core.exceptions import NotFoundException, ValidationException
from app.core.logging import get_logger
from app.schemas.courtroom import CourtroomCase, CourtroomCaseCreate
from app.services.courtroom.engine import CourtroomEngine
from app.services.market_data import MarketDataService, get_market_data_service

logger = get_logger("ghost.courtroom.service")


class CourtroomService:
    """Orchestrates adversarial case evaluations and manages case persistence."""

    def __init__(
        self,
        market_data_service: Optional[MarketDataService] = None,
        engine: Optional[CourtroomEngine] = None,
    ) -> None:
        self.market_data_service = market_data_service or get_market_data_service()
        self.engine = engine or CourtroomEngine()
        # Thread-safe in-memory cache for fast case retrieval and persistence
        self._cases: Dict[str, CourtroomCase] = {}
        self._lock = asyncio.Lock()

    def _generate_case_id(self) -> str:
        """Generates a human-friendly unique case identifier, e.g. CASE-GHOST-4821."""
        digits = "".join(random.choices(string.digits, k=4))
        return f"CASE-GHOST-{digits}"

    async def create_case(self, submission: CourtroomCaseCreate) -> CourtroomCase:
        """Convenes a new Courtroom session, runs adversarial analysis, and stores the record."""
        symbol = submission.symbol.upper().replace("/", "").replace("-", "").strip()
        timeframe = submission.timeframe.strip()
        valid_timeframes = ["5m", "15m", "1h", "4h", "1d", "1w", "1D", "1W"]

        if timeframe not in valid_timeframes:
            raise ValidationException(
                f"Unsupported timeframe '{timeframe}'. Supported timeframes: 5m, 15m, 1h, 4h, 1D, 1W"
            )

        case_id = self._generate_case_id()
        logger.info(
            "Convening Courtroom [%s] for %s on %s timeframe with thesis: '%s'",
            case_id,
            symbol,
            timeframe,
            submission.thesis[:60],
        )

        # 1. Fetch real market telemetry asynchronously
        try:
            candles_task = self.market_data_service.get_ohlcv(symbol, timeframe=timeframe, limit=100)
            ticker_task = self.market_data_service.get_volume_24h(symbol)
            price_task = self.market_data_service.get_current_price(symbol)
            orderbook_task = self.market_data_service.get_orderbook(symbol, depth=20)

            candles, ticker, price, order_book = await asyncio.gather(
                candles_task, ticker_task, price_task, orderbook_task, return_exceptions=True
            )

            if isinstance(candles, Exception) or not candles:
                raise ValidationException(f"Market data unavailable for symbol '{symbol}': {candles}")

            # Fallback for ticker / price / orderbook if gather caught an exception
            if isinstance(ticker, Exception):
                logger.warning("Ticker fetch encountered exception: %s", ticker)
                ticker = None
            if isinstance(price, Exception):
                logger.warning("Price fetch encountered exception: %s", price)
                price = None
            if isinstance(order_book, Exception):
                logger.warning("Order book fetch encountered exception: %s", order_book)
                order_book = None

        except Exception as exc:
            logger.error("Failed to gather live market data for Courtroom: %s", exc)
            raise ValidationException(f"Courtroom could not collect real market telemetry: {exc}")

        # 2. Evaluate through Adversarial Engine
        courtroom_case = self.engine.evaluate_case(
            case_id=case_id,
            submission=submission,
            candles=candles,
            ticker=ticker,
            price=price,
            order_book=order_book,
        )

        # 3. Persist case
        async with self._lock:
            self._cases[case_id] = courtroom_case

        logger.info(
            "Courtroom case [%s] completed. Verdict: %s (%d evidence items)",
            case_id,
            courtroom_case.verdict.value,
            courtroom_case.evidence_count,
        )
        return courtroom_case

    async def get_case(self, case_id: str) -> CourtroomCase:
        """Retrieves a previously convened Courtroom case by its ID."""
        async with self._lock:
            case = self._cases.get(case_id.upper())
            if not case:
                # Try case_id as-is
                case = self._cases.get(case_id)

        if not case:
            raise NotFoundException(f"Courtroom case '{case_id}' was not found.")

        return case

    async def list_cases(self, limit: int = 20) -> List[CourtroomCase]:
        """Retrieves recent Courtroom cases ordered by inception time descending."""
        async with self._lock:
            cases = list(self._cases.values())
        cases.sort(key=lambda c: c.created_at, reverse=True)
        return cases[:limit]


# Global singleton instance
_courtroom_service: Optional[CourtroomService] = None


def get_courtroom_service() -> CourtroomService:
    """FastAPI dependency provider for CourtroomService."""
    global _courtroom_service
    if _courtroom_service is None:
        _courtroom_service = CourtroomService()
    return _courtroom_service
