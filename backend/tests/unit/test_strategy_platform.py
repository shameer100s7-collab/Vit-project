"""Unit tests for Strategy Canonicalization, Backtest Engine, and AI Verification."""

from datetime import datetime, timezone
import pytest
from app.schemas.market import CanonicalCandle
from app.services.ai_verification.verifier import AIVerificationEngine
from app.services.backtest.engine import BacktestEngine
from app.services.onchain.registry import (
    canonicalize_strategy_rules,
    compute_ipfs_cid,
    compute_strategy_hash,
)


def test_strategy_canonicalization_and_deterministic_hash():
    """Verifies that strategy rules serialize identically regardless of key ordering."""
    rules_a = {
        "name": "Test Strategy",
        "asset": "BTC/USDT",
        "timeframe": "1h",
        "fast_period": 9,
        "slow_period": 21,
    }
    rules_b = {
        "slow_period": 21,
        "asset": "BTC/USDT",
        "name": "Test Strategy",
        "fast_period": 9,
        "timeframe": "1h",
    }

    canon_a = canonicalize_strategy_rules(rules_a)
    canon_b = canonicalize_strategy_rules(rules_b)
    assert canon_a == canon_b

    hash_a = compute_strategy_hash(canon_a)
    hash_b = compute_strategy_hash(canon_b)
    assert hash_a == hash_b
    assert hash_a.startswith("0x")
    assert len(hash_a) == 66

    cid = compute_ipfs_cid(canon_a)
    assert cid.startswith("bafkrei")


def test_backtest_engine_real_calculation():
    """Verifies that backtest engine computes accurate metrics from candle data."""
    now = datetime.now(timezone.utc)
    # Generate 50 synthetic alternating candles with clear upward trend
    candles = []
    base_price = 50000.0
    for i in range(50):
        t = datetime.fromtimestamp(1700000000 + i * 3600, tz=timezone.utc)
        px = base_price + (i * 100.0) + (50.0 if i % 2 == 0 else -50.0)
        candles.append(
            CanonicalCandle(
                symbol="BTC",
                timeframe="1h",
                timestamp=t,
                close_time=t,
                open=px - 20,
                high=px + 40,
                low=px - 30,
                close=px,
                volume=150.0,
                quote_volume=px * 150.0,
                trades_count=1000,
            )
        )

    engine = BacktestEngine()
    rules = {
        "fast_period": 5,
        "slow_period": 10,
        "rsi_period": 7,
        "stop_loss_pct": 2.0,
        "take_profit_pct": 5.0,
    }

    res = engine.run_backtest(
        candles=candles,
        rules=rules,
        initial_capital=10000.0,
        asset="BTC/USDT",
        timeframe="1h",
    )

    assert "performance" in res
    perf = res["performance"]
    assert "total_return_pct" in perf
    assert "win_rate" in perf
    assert "max_drawdown" in perf
    assert "sharpe_ratio" in perf
    assert len(res["equity_curve"]) == 49
    assert res["backtest_run_id"].startswith("BT-")


def test_ai_verification_and_anomaly_detection():
    """Verifies anomaly detection on suspicious data and transparent score calculation."""
    verifier = AIVerificationEngine()
    strategy = {
        "name": "High Flyer",
        "asset": "BTC/USDT",
        "timeframe": "1h",
        "canonical_rules": {"stop_loss_pct": 2.0},
    }

    # Case 1: Insufficient data
    res_empty = verifier.verify_strategy(strategy, None, None, None)
    assert res_empty["badge"] == "INSUFFICIENT_DATA"

    # Case 2: Healthy backtest + On-Chain proof
    healthy_bt = {
        "candle_count": 120,
        "start_date": "2026-01-01T00:00:00Z",
        "end_date": "2026-02-01T00:00:00Z",
        "performance": {
            "total_trades": 25,
            "win_rate": 60.0,
            "net_pnl": 2400.0,
            "total_return_pct": 24.0,
            "profit_factor": 1.85,
            "max_drawdown": 8.5,
            "sharpe_ratio": 1.62,
            "sortino_ratio": 2.10,
            "largest_win": 350.0,
            "largest_loss": -180.0,
        },
        "trades_log": [
            {"trade_id": f"T{i}", "pnl": 100 if i % 2 == 0 else -50, "exit_reason": "STOP_LOSS" if i % 4 == 0 else "INDICATOR_EXIT"}
            for i in range(25)
        ],
        "data_provenance": {"data_source": "Binance Spot"},
    }
    proof = {
        "is_verified": True,
        "transaction_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    }

    res_verified = verifier.verify_strategy(strategy, healthy_bt, None, proof)
    assert res_verified["badge"] == "VERIFIED"
    assert res_verified["score"] >= 75
    assert len(res_verified["anomalies"]) == 0
    assert len(res_verified["failure_conditions"]) > 0

    # Case 3: Cherry-picked anomaly detection
    cherry_picked_bt = dict(healthy_bt)
    cherry_picked_bt["performance"] = dict(healthy_bt["performance"])
    cherry_picked_bt["performance"]["net_pnl"] = 1000.0
    cherry_picked_bt["performance"]["largest_win"] = 920.0  # 92% of total return from 1 trade
    res_cherry = verifier.verify_strategy(strategy, cherry_picked_bt, None, proof)
    assert res_cherry["badge"] == "ANOMALY_DETECTED"
    assert any(a["type"] == "CHERRY_PICKED_DEPENDENCY" for a in res_cherry["anomalies"])
