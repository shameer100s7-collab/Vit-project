"""Live paper trading service executing strategy signals against live market prices."""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from app.core.exceptions import NotFoundException, ValidationException
from app.core.logging import get_logger
from app.services.market_data import MarketDataService, get_market_data_service

logger = get_logger("ghost.paper_trading")


class PaperTradingService:
    """Manages real-time paper trading executions without risking real capital."""

    def __init__(self, market_data_service: Optional[MarketDataService] = None) -> None:
        self.market_data_service = market_data_service or get_market_data_service()
        # In-memory registry of active paper trading states keyed by strategy_id
        self._states: Dict[str, Dict[str, Any]] = {}
        self._trades: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = asyncio.Lock()

    async def start_paper_trading(
        self,
        strategy_id: str,
        asset: str,
        initial_capital: float = 10000.0,
    ) -> Dict[str, Any]:
        """Initializes or resumes live paper trading session for a strategy."""
        async with self._lock:
            if strategy_id in self._states and self._states[strategy_id].get("is_active"):
                return await self.get_paper_status(strategy_id)

            # Retrieve current real market price to establish baseline
            try:
                price_obj = await self.market_data_service.get_current_price(asset)
                current_price = price_obj.price
            except Exception as exc:
                logger.warning("Could not fetch initial live price for %s: %s", asset, exc)
                current_price = 0.0

            now = datetime.now(timezone.utc)
            self._states[strategy_id] = {
                "strategy_id": strategy_id,
                "asset": asset,
                "is_active": True,
                "started_at": now.isoformat(),
                "initial_capital": initial_capital,
                "cash_balance": initial_capital,
                "last_signal": "HOLD",
                "last_signal_time": now.isoformat(),
                "last_checked_price": current_price,
                "open_position": None,
                "realized_pnl": 0.0,
            }
            if strategy_id not in self._trades:
                self._trades[strategy_id] = []

            return await self._format_status(strategy_id)

    async def stop_paper_trading(self, strategy_id: str) -> Dict[str, Any]:
        """Halts active paper trading and liquidates any open simulated position."""
        async with self._lock:
            if strategy_id not in self._states:
                raise NotFoundException(f"No paper trading session found for strategy '{strategy_id}'.")

            state = self._states[strategy_id]
            if state.get("open_position"):
                pos = state["open_position"]
                try:
                    price_obj = await self.market_data_service.get_current_price(state["asset"])
                    exit_price = price_obj.price
                except Exception:
                    exit_price = pos["entry_price"]

                trade_pnl = (exit_price - pos["entry_price"]) * pos["quantity"]
                state["realized_pnl"] += trade_pnl
                state["cash_balance"] += (exit_price * pos["quantity"])

                self._trades[strategy_id].append({
                    "trade_id": f"PTRD-{uuid.uuid4().hex[:6].upper()}",
                    "strategy_id": strategy_id,
                    "asset": state["asset"],
                    "direction": "SELL",
                    "entry_price": pos["entry_price"],
                    "exit_price": exit_price,
                    "quantity": pos["quantity"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "pnl": round(trade_pnl, 2),
                    "exit_reason": "SESSION_HALT",
                })
                state["open_position"] = None

            state["is_active"] = False
            return await self._format_status(strategy_id)

    async def evaluate_tick(
        self,
        strategy_id: str,
        rules: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Polls live market price and executes any triggered simulated trades."""
        async with self._lock:
            if strategy_id not in self._states or not self._states[strategy_id].get("is_active"):
                return {"status": "INACTIVE", "message": "Paper trading is not running."}

            state = self._states[strategy_id]
            asset = state["asset"]

            # Pull live exchange price and 1h candles
            try:
                price_obj = await self.market_data_service.get_current_price(asset)
                current_price = price_obj.price
                candles = await self.market_data_service.get_ohlcv(asset, timeframe="1h", limit=30)
            except Exception as exc:
                logger.error("Paper trading tick failed to fetch live data: %s", exc)
                return await self._format_status(strategy_id)

            state["last_checked_price"] = current_price
            closes = [float(c.close) for c in candles]
            closes.append(current_price)

            # Compute EMAs
            fast_span = int(rules.get("fast_period", 9))
            slow_span = int(rules.get("slow_period", 21))
            
            # Simple EMA calculation
            multiplier_fast = 2 / (fast_span + 1)
            multiplier_slow = 2 / (slow_span + 1)
            ema_f = closes[0]
            ema_s = closes[0]
            for p in closes:
                ema_f = (p - ema_f) * multiplier_fast + ema_f
                ema_s = (p - ema_s) * multiplier_slow + ema_s

            now = datetime.now(timezone.utc)

            # Signal logic
            if ema_f > ema_s and not state["open_position"]:
                # Trigger BUY
                investable = state["cash_balance"] * 0.95
                if investable > 20.0:
                    qty = round(investable / current_price, 4)
                    state["open_position"] = {
                        "direction": "BUY",
                        "entry_price": current_price,
                        "quantity": qty,
                        "entry_time": now.isoformat(),
                    }
                    state["cash_balance"] -= (qty * current_price)
                    state["last_signal"] = "BUY"
                    state["last_signal_time"] = now.isoformat()

            elif ema_f < ema_s and state["open_position"]:
                # Trigger SELL
                pos = state["open_position"]
                pnl = (current_price - pos["entry_price"]) * pos["quantity"]
                state["realized_pnl"] += pnl
                state["cash_balance"] += (pos["quantity"] * current_price)
                
                self._trades[strategy_id].append({
                    "trade_id": f"PTRD-{uuid.uuid4().hex[:6].upper()}",
                    "strategy_id": strategy_id,
                    "asset": asset,
                    "direction": "SELL",
                    "entry_price": pos["entry_price"],
                    "exit_price": current_price,
                    "quantity": pos["quantity"],
                    "timestamp": now.isoformat(),
                    "pnl": round(pnl, 2),
                    "exit_reason": "SIGNAL_CROSS",
                })
                state["open_position"] = None
                state["last_signal"] = "SELL"
                state["last_signal_time"] = now.isoformat()
            else:
                state["last_signal"] = "HOLD"

            return await self._format_status(strategy_id)

    async def get_paper_status(self, strategy_id: str) -> Dict[str, Any]:
        """Returns the current live paper-trading metrics and trade history."""
        async with self._lock:
            if strategy_id not in self._states:
                return {
                    "strategy_id": strategy_id,
                    "is_active": False,
                    "status": "NOT_STARTED",
                    "started_at": None,
                    "last_signal": "NONE",
                    "last_signal_time": None,
                    "open_position": None,
                    "realized_pnl": 0.0,
                    "unrealized_pnl": 0.0,
                    "total_trades": 0,
                    "win_rate": 0.0,
                    "trades": [],
                }
            return await self._format_status(strategy_id)

    async def _format_status(self, strategy_id: str) -> Dict[str, Any]:
        state = self._states[strategy_id]
        trades = self._trades.get(strategy_id, [])

        unrealized = 0.0
        if state.get("open_position"):
            pos = state["open_position"]
            current_px = state.get("last_checked_price", pos["entry_price"])
            unrealized = (current_px - pos["entry_price"]) * pos["quantity"]

        winning = [t for t in trades if t.get("pnl", 0) > 0]
        win_rate = (len(winning) / len(trades) * 100.0) if trades else 0.0

        return {
            "strategy_id": strategy_id,
            "asset": state["asset"],
            "is_active": state["is_active"],
            "status": "ACTIVE" if state["is_active"] else "STOPPED",
            "started_at": state["started_at"],
            "last_signal": state["last_signal"],
            "last_signal_time": state["last_signal_time"],
            "current_price": state.get("last_checked_price", 0.0),
            "open_position": state.get("open_position"),
            "realized_pnl": round(state["realized_pnl"], 2),
            "unrealized_pnl": round(unrealized, 2),
            "total_trades": len(trades),
            "win_rate": round(win_rate, 2),
            "trades": trades,
        }


_global_paper_trading_service: Optional[PaperTradingService] = None


def get_paper_trading_service() -> PaperTradingService:
    global _global_paper_trading_service
    if _global_paper_trading_service is None:
        _global_paper_trading_service = PaperTradingService()
    return _global_paper_trading_service
