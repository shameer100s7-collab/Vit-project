"""Integration tests for Strategies API routes."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_list_and_create_strategies():
    """Verifies listing and creating strategies via REST endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. List pre-seeded strategies
        res = await ac.get("/api/v1/strategies")
        assert res.status_code == 200
        strats = res.json()
        assert len(strats) >= 3
        btc_strat = next((s for s in strats if s["id"] == "strat-btc-ema-cross"), None)
        assert btc_strat is not None
        assert btc_strat["strategy_hash"].startswith("0x")

        # 2. Create a new strategy
        payload = {
            "name": "Custom Breakout System",
            "description": "Custom breakout rules",
            "asset": "BTC/USDT",
            "timeframe": "1h",
            "entry_condition": "EMA9 > EMA21",
            "exit_condition": "EMA9 < EMA21",
            "fast_period": 9,
            "slow_period": 21,
            "rsi_period": 14,
            "stop_loss_pct": 2.0,
            "take_profit_pct": 5.0,
            "position_sizing_pct": 100.0,
        }
        res_create = await ac.post("/api/v1/strategies", json=payload)
        assert res_create.status_code == 201
        created = res_create.json()
        assert created["name"] == "Custom Breakout System"
        assert created["strategy_hash"].startswith("0x")
        assert created["ipfs_cid"].startswith("bafkrei")
        assert created["is_onchain"] is False

        # 3. Retrieve on-chain proof for un-registered strategy
        res_proof = await ac.get(f"/api/v1/strategies/{created['id']}/onchain")
        assert res_proof.status_code == 200
        proof = res_proof.json()
        assert proof["status"] == "NOT_REGISTERED"
        assert proof["transaction_hash"] is None

        # 4. Register on-chain
        res_reg = await ac.post(f"/api/v1/strategies/{created['id']}/register-onchain")
        assert res_reg.status_code == 200
        reg_proof = res_reg.json()
        assert reg_proof["status"] == "REGISTERED"
        assert reg_proof["transaction_hash"].startswith("0x")
        assert reg_proof["is_verified"] is True

        # 5. Paper trading lifecycle
        res_start = await ac.post(f"/api/v1/strategies/{created['id']}/paper-trading/start")
        assert res_start.status_code == 200
        paper_state = res_start.json()
        assert paper_state["is_active"] is True

        res_stop = await ac.post(f"/api/v1/strategies/{created['id']}/paper-trading/stop")
        assert res_stop.status_code == 200
        stopped_state = res_stop.json()
        assert stopped_state["is_active"] is False
