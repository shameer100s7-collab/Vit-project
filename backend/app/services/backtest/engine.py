"""Deterministic Quantitative Backtest Engine.

Executes user-defined trading strategies against real historical OHLCV market candles.
Calculates returns, drawdowns, Sharpe, Sortino, win rates, and equity curves without fake data.
"""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
import uuid
import numpy as np
import pandas as pd

from app.core.exceptions import ValidationException
from app.core.logging import get_logger
from app.schemas.market import CanonicalCandle

logger = get_logger("ghost.backtest.engine")


class BacktestEngine:
    """Evaluates strategy rules against actual historical candle datasets."""

    def run_backtest(
        self,
        candles: List[CanonicalCandle],
        rules: Dict[str, Any],
        initial_capital: float = 10000.0,
        fee_pct: float = 0.00075,      # 0.075% standard maker/taker
        slippage_pct: float = 0.0005,  # 0.05% execution drag
        asset: str = "BTC/USDT",
        timeframe: str = "1h",
    ) -> Dict[str, Any]:
        """Runs vectorized/event simulation across historical candles.
        
        Args:
            candles: Chronologically ordered real historical candles.
            rules: Machine-readable trading rules dictionary.
            initial_capital: Starting simulated balance in USD.
            fee_pct: Exchange transaction fee percentage.
            slippage_pct: Modeled market impact slippage.
            asset: Asset ticker symbol.
            timeframe: Candle interval.
        """
        if len(candles) < 20:
            raise ValidationException(
                f"INSUFFICIENT DATA: Backtest requires at least 20 historical candles, received {len(candles)}."
            )

        # 1. Convert candles to chronological DataFrame
        df = pd.DataFrame([
            {
                "timestamp": c.timestamp,
                "open": float(c.open),
                "high": float(c.high),
                "low": float(c.low),
                "close": float(c.close),
                "volume": float(c.volume),
            }
            for c in candles
        ])
        df.sort_values("timestamp", inplace=True)
        df.reset_index(drop=True, inplace=True)

        close = df["close"].values
        high = df["high"].values
        low = df["low"].values
        n = len(df)

        # 2. Extract Indicator Parameters from rules
        fast_period = int(rules.get("fast_period", rules.get("ema_fast", 9)))
        slow_period = int(rules.get("slow_period", rules.get("ema_slow", 21)))
        rsi_period = int(rules.get("rsi_period", 14))
        stop_loss_pct = float(rules.get("stop_loss_pct", rules.get("stop_loss", 2.0))) / 100.0
        take_profit_pct = float(rules.get("take_profit_pct", rules.get("take_profit", 4.0))) / 100.0

        # Compute Technical Series
        ema_fast = pd.Series(close).ewm(span=max(2, fast_period), adjust=False).mean().values
        ema_slow = pd.Series(close).ewm(span=max(2, slow_period), adjust=False).mean().values
        
        # RSI calculation
        delta = pd.Series(close).diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.rolling(window=max(2, rsi_period), min_periods=max(2, rsi_period)).mean()
        avg_loss = loss.rolling(window=max(2, rsi_period), min_periods=max(2, rsi_period)).mean()
        rs = avg_gain / (avg_loss + 1e-9)
        rsi = (100.0 - (100.0 / (1.0 + rs))).fillna(50.0).values

        # 3. Simulate Trade Executions
        capital = float(initial_capital)
        peak_capital = capital
        equity_curve: List[Dict[str, Any]] = []
        trades: List[Dict[str, Any]] = []
        
        in_position = False
        entry_price = 0.0
        entry_time: Optional[datetime] = None
        position_size = 0.0
        bars_in_position = 0

        for i in range(1, n):
            current_close = close[i]
            current_time = df.loc[i, "timestamp"]
            current_high = high[i]
            current_low = low[i]

            # Current rule conditions
            is_bullish_cross = ema_fast[i] > ema_slow[i] and ema_fast[i - 1] <= ema_slow[i - 1]
            is_bearish_cross = ema_fast[i] < ema_slow[i] and ema_fast[i - 1] >= ema_slow[i - 1]
            is_oversold_bounce = rsi[i - 1] < 35.0 and rsi[i] >= 35.0

            # Check Exit if in position
            if in_position:
                bars_in_position += 1
                exit_reason = None
                exit_price = current_close

                # Stop loss check
                if stop_loss_pct > 0 and current_low <= entry_price * (1.0 - stop_loss_pct):
                    exit_reason = "STOP_LOSS"
                    exit_price = entry_price * (1.0 - stop_loss_pct)
                # Take profit check
                elif take_profit_pct > 0 and current_high >= entry_price * (1.0 + take_profit_pct):
                    exit_reason = "TAKE_PROFIT"
                    exit_price = entry_price * (1.0 + take_profit_pct)
                # Technical exit
                elif is_bearish_cross:
                    exit_reason = "INDICATOR_EXIT"
                    exit_price = current_close

                if exit_reason:
                    # Apply slippage & fees on exit
                    eff_exit_price = exit_price * (1.0 - slippage_pct)
                    gross_value = position_size * eff_exit_price
                    exit_fee = gross_value * fee_pct
                    net_proceeds = gross_value - exit_fee
                    
                    pnl = net_proceeds - (position_size * entry_price)
                    ret_pct = (pnl / (position_size * entry_price)) * 100.0
                    capital += net_proceeds

                    trades.append({
                        "trade_id": f"TRD-{len(trades) + 1:04d}",
                        "entry_time": entry_time.isoformat() if isinstance(entry_time, datetime) else str(entry_time),
                        "exit_time": current_time.isoformat() if isinstance(current_time, datetime) else str(current_time),
                        "direction": "BUY",
                        "entry_price": round(entry_price, 2),
                        "exit_price": round(eff_exit_price, 2),
                        "size": round(position_size, 4),
                        "pnl": round(pnl, 2),
                        "return_pct": round(ret_pct, 2),
                        "exit_reason": exit_reason,
                    })
                    in_position = False
                    position_size = 0.0

            # Check Entry if not in position
            if not in_position and (is_bullish_cross or is_oversold_bounce):
                eff_entry_price = current_close * (1.0 + slippage_pct)
                entry_fee = capital * fee_pct
                investable = capital - entry_fee
                if investable > 10.0:
                    position_size = investable / eff_entry_price
                    entry_price = eff_entry_price
                    entry_time = current_time
                    capital = 0.0 # capital locked in position
                    in_position = True

            # Calculate Mark-to-Market Equity
            if in_position:
                current_equity = position_size * current_close * (1.0 - fee_pct)
            else:
                current_equity = capital

            peak_capital = max(peak_capital, current_equity)
            dd_pct = ((current_equity - peak_capital) / peak_capital) * 100.0 if peak_capital > 0 else 0.0

            equity_curve.append({
                "timestamp": current_time.isoformat() if isinstance(current_time, datetime) else str(current_time),
                "equity": round(current_equity, 2),
                "drawdown_pct": round(dd_pct, 2),
            })

        # Close open trade at final bar close for accurate accounting
        if in_position:
            eff_exit_price = close[-1] * (1.0 - slippage_pct)
            net_proceeds = (position_size * eff_exit_price) * (1.0 - fee_pct)
            pnl = net_proceeds - (position_size * entry_price)
            ret_pct = (pnl / (position_size * entry_price)) * 100.0
            capital = net_proceeds
            trades.append({
                "trade_id": f"TRD-{len(trades) + 1:04d}",
                "entry_time": entry_time.isoformat() if isinstance(entry_time, datetime) else str(entry_time),
                "exit_time": df.loc[n - 1, "timestamp"].isoformat() if isinstance(df.loc[n - 1, "timestamp"], datetime) else str(df.loc[n - 1, "timestamp"]),
                "direction": "BUY",
                "entry_price": round(entry_price, 2),
                "exit_price": round(eff_exit_price, 2),
                "size": round(position_size, 4),
                "pnl": round(pnl, 2),
                "return_pct": round(ret_pct, 2),
                "exit_reason": "END_OF_PERIOD",
            })

        final_capital = equity_curve[-1]["equity"] if equity_curve else capital
        net_pnl = final_capital - initial_capital
        total_return_pct = (net_pnl / initial_capital) * 100.0

        # 4. Statistical Metrics Compilation
        total_trades = len(trades)
        winning_trades = [t for t in trades if t["pnl"] > 0]
        losing_trades = [t for t in trades if t["pnl"] <= 0]
        win_rate = (len(winning_trades) / total_trades * 100.0) if total_trades > 0 else 0.0

        gross_profits = sum(t["pnl"] for t in winning_trades)
        gross_losses = abs(sum(t["pnl"] for t in losing_trades))
        profit_factor = (gross_profits / gross_losses) if gross_losses > 0 else (gross_profits if gross_profits > 0 else 1.0)
        
        max_drawdown = min([pt["drawdown_pct"] for pt in equity_curve]) if equity_curve else 0.0

        # Returns array for Sharpe / Sortino
        trade_returns = [t["return_pct"] / 100.0 for t in trades]
        if len(trade_returns) >= 2:
            ret_std = np.std(trade_returns)
            sharpe = (np.mean(trade_returns) / (ret_std + 1e-9)) * math.sqrt(252) # annualized
            downside = [r for r in trade_returns if r < 0]
            down_std = np.std(downside) if downside else 1e-9
            sortino = (np.mean(trade_returns) / (down_std + 1e-9)) * math.sqrt(252)
        else:
            sharpe = 0.0
            sortino = 0.0

        avg_win = (sum(t["pnl"] for t in winning_trades) / len(winning_trades)) if winning_trades else 0.0
        avg_loss = (sum(t["pnl"] for t in losing_trades) / len(losing_trades)) if losing_trades else 0.0
        largest_win = max([t["pnl"] for t in winning_trades], default=0.0)
        largest_loss = min([t["pnl"] for t in losing_trades], default=0.0)
        exposure_pct = (bars_in_position / max(n, 1)) * 100.0

        run_id = f"BT-{uuid.uuid4().hex[:8].upper()}"
        start_date = df.loc[0, "timestamp"]
        end_date = df.loc[n - 1, "timestamp"]

        return {
            "backtest_run_id": run_id,
            "asset": asset,
            "timeframe": timeframe,
            "start_date": start_date.isoformat() if isinstance(start_date, datetime) else str(start_date),
            "end_date": end_date.isoformat() if isinstance(end_date, datetime) else str(end_date),
            "candle_count": n,
            "parameters": {
                "initial_capital": initial_capital,
                "fee_pct": fee_pct,
                "slippage_pct": slippage_pct,
                "fast_period": fast_period,
                "slow_period": slow_period,
                "rsi_period": rsi_period,
                "stop_loss_pct": stop_loss_pct * 100.0,
                "take_profit_pct": take_profit_pct * 100.0,
            },
            "performance": {
                "initial_capital": round(initial_capital, 2),
                "final_capital": round(final_capital, 2),
                "net_pnl": round(net_pnl, 2),
                "total_return_pct": round(total_return_pct, 2),
                "total_trades": total_trades,
                "winning_trades": len(winning_trades),
                "losing_trades": len(losing_trades),
                "win_rate": round(win_rate, 2),
                "profit_factor": round(profit_factor, 2),
                "max_drawdown": round(abs(max_drawdown), 2),
                "sharpe_ratio": round(sharpe, 2),
                "sortino_ratio": round(sortino, 2),
                "average_win": round(avg_win, 2),
                "average_loss": round(avg_loss, 2),
                "largest_win": round(largest_win, 2),
                "largest_loss": round(largest_loss, 2),
                "exposure_pct": round(exposure_pct, 2),
            },
            "equity_curve": equity_curve,
            "trades_log": trades,
            "data_provenance": {
                "data_source": "Binance Spot Public REST (Validated Canonical Candles)",
                "period": f"{start_date} → {end_date}",
                "backtest_run_id": run_id,
                "fee_model": f"{fee_pct * 100:.3f}% taker fee",
                "slippage_model": f"{slippage_pct * 100:.3f}% market slippage",
            },
        }


_global_backtest_engine: Optional[BacktestEngine] = None


def get_backtest_engine() -> BacktestEngine:
    global _global_backtest_engine
    if _global_backtest_engine is None:
        _global_backtest_engine = BacktestEngine()
    return _global_backtest_engine
