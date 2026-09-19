"""API integration tests for Quantitative Risk Engine endpoints."""

import pytest
from httpx import AsyncClient

from app.schemas.risk import RiskLevel


@pytest.mark.asyncio
async def test_get_asset_risk_success(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/risk/BTC returns standard envelope with complete risk metrics."""
    response = await async_client.get("/api/v1/risk/BTC")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert "data" in body
    data = body["data"]

    # Asset & Risk Classification
    assert data["symbol"] == "BTC"
    assert 0.05 <= data["overall_risk_score"] <= 0.95
    assert data["risk_level"] in [lvl.value for lvl in RiskLevel]

    # VaR metrics
    assert "var_metrics" in data
    var_m = data["var_metrics"]
    assert var_m["var_95_daily"] >= 0.0
    assert var_m["cvar_95_daily"] >= var_m["var_95_daily"]

    # Drawdown metrics
    assert "drawdown_metrics" in data
    dd_m = data["drawdown_metrics"]
    assert dd_m["max_drawdown"] <= 0.0
    assert dd_m["peak_price"] > 0.0

    # Risk-adjusted performance metrics
    assert "risk_adjusted_metrics" in data
    adj_m = data["risk_adjusted_metrics"]
    assert adj_m["annualized_volatility"] >= 0.0
    assert isinstance(adj_m["sharpe_ratio"], float)
    assert isinstance(adj_m["sortino_ratio"], float)

    # Position sizing recommendations
    assert "position_sizing" in data
    ps = data["position_sizing"]
    assert 0.02 <= ps["max_position_pct"] <= 0.40
    assert ps["recommended_leverage"] >= 1.0

    # Metadata & Persistence ID
    assert "metadata" in body
    assert body["metadata"]["symbol"] == "BTC"
    assert "request_id" in body["metadata"]
    assert data["analysis_id"] is not None


@pytest.mark.asyncio
async def test_get_asset_risk_custom_params(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/risk/ETH with custom timeframe, lookback, and benchmark."""
    response = await async_client.get("/api/v1/risk/ETH?timeframe=4h&limit=50&benchmark=BTC/USDT")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    data = body["data"]
    assert data["symbol"] == "ETH"
    assert data["sensitivity_metrics"] is not None
    assert data["sensitivity_metrics"]["benchmark_symbol"] == "BTC/USDT"


@pytest.mark.asyncio
async def test_get_asset_risk_history(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/risk/SOL/history returns chronological audit records."""
    # First invoke risk evaluation to ensure at least one record is persisted
    eval_resp = await async_client.get("/api/v1/risk/SOL")
    assert eval_resp.status_code == 200

    # Query history
    response = await async_client.get("/api/v1/risk/SOL/history?limit=10")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert isinstance(body["data"], list)
    assert len(body["data"]) >= 1

    first = body["data"][0]
    assert first["target_type"] == "ASSET"
    assert first["target_id"] == "SOL"
    assert first["overall_risk"] >= 0.0
    assert first["volatility"] >= 0.0
    assert "metrics_payload" in first


@pytest.mark.asyncio
async def test_evaluate_custom_portfolio_risk(async_client: AsyncClient) -> None:
    """Verify POST /api/v1/risk/portfolio calculates covariance, VaR, and HHI concentration."""
    payload = {
        "assets": [
            {"symbol": "BTC", "weight": 0.6},
            {"symbol": "ETH", "weight": 0.4},
        ],
        "benchmark_symbol": "BTC/USDT",
        "portfolio_name": "CoreDeFi",
    }
    response = await async_client.post("/api/v1/risk/portfolio", json=payload)
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    data = body["data"]
    assert data["portfolio_name"] == "CoreDeFi"
    assert 0.05 <= data["overall_risk_score"] <= 0.95
    assert data["portfolio_volatility_annualized"] > 0.0
    assert data["portfolio_var_95_daily"] >= 0.0

    # Concentration & Marginal Contributions
    assert "concentration" in data
    assert data["concentration"]["hhi"] > 0.0
    assert "BTC" in data["concentration"]["asset_weights"]
    assert "ETH" in data["concentration"]["asset_weights"]
    assert "marginal_risk_contributions" in data
    assert "component_risks" in data
    assert "BTC" in data["component_risks"]
    assert "ETH" in data["component_risks"]


@pytest.mark.asyncio
async def test_get_asset_risk_not_found(async_client: AsyncClient) -> None:
    """Verify GET /api/v1/risk/{symbol} returns 404 for unresolvable cryptocurrency asset."""
    response = await async_client.get("/api/v1/risk/UNRESOLVABLE_SYMBOL_999")
    assert response.status_code == 404
    body = response.json()

    assert body["success"] is False
    assert "error" in body
    assert body["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_get_asset_risk_request_id_preserved(async_client: AsyncClient) -> None:
    """Verify correlation X-Request-ID header is preserved in metadata and headers."""
    custom_id = "test-custom-risk-req-001"
    response = await async_client.get("/api/v1/risk/BTC", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    body = response.json()

    assert body["metadata"]["request_id"] == custom_id
    assert response.headers.get("X-Request-ID") == custom_id
