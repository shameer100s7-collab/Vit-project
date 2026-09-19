# Quantitative Risk Engine

## 1. Overview and Core Philosophy

The **Quantitative Risk Engine** is the foundational capital preservation and risk management layer of the GHOST platform.

### Core Philosophy
1. **Mathematical Rigor Over Intuition**: Risk is quantified using empirical probability distributions, cross-asset covariance matrices, and extreme value theory rather than qualitative rules of thumb.
2. **Dual VaR/CVaR Architecture**: To protect against both normal variance and fat-tailed black swan crypto distributions, both Gaussian parametric (variance-covariance) and empirical historical simulation models are evaluated concurrently.
3. **Downside-Conscious Risk Attribution**: Traditional volatility penalizes upside price explosion equally with downside crash velocity. The Risk Engine isolates downside semi-deviation (Sortino ratio) and peak-to-trough drawdowns (Calmar ratio) to reward true risk-adjusted alpha.
4. **End-to-End Persistence**: Every computed risk profile is recorded in the PostgreSQL/SQLite `risk_analyses` table via `RiskRepository` for historical auditability and risk trend monitoring.

---

## 2. Mathematical Formulations

### 1. Value at Risk (VaR)
VaR measures the maximum expected loss over a specific time horizon $h$ (default 1 day) at confidence level $\alpha \in \{0.95, 0.99\}$.

#### A. Parametric (Variance-Covariance) VaR
Assumes returns follow a normal distribution with mean $\mu$ and standard deviation $\sigma$:
$$\text{VaR}_{\alpha}^{\text{param}} = \max\left(0.0, (z_{\alpha} \cdot \sigma - \mu) \cdot \sqrt{h}\right)$$
where $z_{0.95} \approx 1.6449$ and $z_{0.99} \approx 2.3263$.

#### B. Historical Simulation VaR
Non-parametric empirical quantile of historical returns without normality assumptions:
$$\text{VaR}_{\alpha}^{\text{hist}} = \max\left(0.0, -q_{1-\alpha}(R) \cdot \sqrt{h}\right)$$
where $q_{1-\alpha}(R)$ is the $(1 - \alpha)$ percentile of the trailing return series $R$.

---

### 2. Conditional Value at Risk (CVaR / Expected Shortfall)
CVaR measures the expected loss conditional on the loss exceeding the VaR cutoff, addressing the tail risk ignored by standard VaR.

#### A. Parametric Gaussian CVaR
$$\text{CVaR}_{\alpha}^{\text{param}} = \max\left(\text{VaR}_{\alpha}, \left(\sigma \cdot \frac{\phi(z_{\alpha})}{1 - \alpha} - \mu\right) \cdot \sqrt{h}\right)$$
where $\phi(z)$ is the standard normal probability density function:
$$\phi(z) = \frac{1}{\sqrt{2\pi}} e^{-\frac{z^2}{2}}$$

#### B. Historical Simulation CVaR
$$\text{CVaR}_{\alpha}^{\text{hist}} = \max\left(\text{VaR}_{\alpha}^{\text{hist}}, -\mathbb{E}[R \mid R \le q_{1-\alpha}(R)] \cdot \sqrt{h}\right)$$

---

### 3. Drawdown Dynamics
- **Peak Price Series**: $M_t = \max_{\tau \le t} P_\tau$
- **Drawdown Series**: $D_t = \frac{P_t - M_t}{M_t} \in [-1.0, 0.0]$
- **Maximum Drawdown (MDD)**:
  $$\text{MDD} = \min_{t} D_t$$
- **Current Drawdown**: $D_{\text{latest}} = \frac{P_{\text{latest}} - M_{\text{latest}}}{M_{\text{latest}}}$
- **Drawdown Duration**: Number of consecutive periods elapsed since the most recent all-time high was established.

---

### 4. Risk-Adjusted Performance Metrics
- **Annualized Return**: $\bar{R}_{\text{ann}} = \bar{R} \times 365$
- **Annualized Volatility**: $\sigma_{\text{ann}} = \sigma_{\text{daily}} \times \sqrt{365}$
- **Downside Semi-Deviation**:
  $$\delta_{\text{downside}} = \sqrt{\frac{1}{N}\sum_{t=1}^N \min\left(0, R_t - \frac{R_f}{365}\right)^2} \times \sqrt{365}$$
- **Sharpe Ratio**:
  $$\text{Sharpe} = \frac{\bar{R}_{\text{ann}} - R_f}{\sigma_{\text{ann}}}$$
- **Sortino Ratio**:
  $$\text{Sortino} = \frac{\bar{R}_{\text{ann}} - R_f}{\delta_{\text{downside}}}$$
- **Calmar Ratio**:
  $$\text{Calmar} = \frac{\bar{R}_{\text{ann}}}{|\text{MDD}|}$$

---

### 5. Market Sensitivity & Systematic Risk (Beta)
Measures the sensitivity of an asset's returns $R_a$ relative to benchmark returns $R_m$ (default `BTC/USDT`):
$$\beta = \frac{\text{Cov}(R_a, R_m)}{\text{Var}(R_m)}$$
$$\text{Correlation } \rho = \frac{\text{Cov}(R_a, R_m)}{\sigma_a \cdot \sigma_m} \in [-1.0, 1.0]$$

---

### 6. Portfolio Concentration & Covariance Risk

#### A. Herfindahl-Hirschman Index (HHI)
$$\text{HHI} = \sum_{i=1}^N w_i^2 \in \left[\frac{1}{N}, 1.0\right]$$
$$\text{Normalized HHI} = \frac{\text{HHI} - \frac{1}{N}}{1 - \frac{1}{N}} \in [0.0, 1.0] \quad (\text{for } N > 1)$$
$$\text{Effective Number of Assets } N_{\text{eff}} = \frac{1}{\text{HHI}}$$

#### B. Portfolio Variance & Marginal Risk Contribution (MRC)
Given weight vector $w$ and sample asset covariance matrix $\Sigma$:
$$\sigma_p^2 = w^T \Sigma w$$
$$\text{MRC}_i = \frac{w_i (\Sigma w)_i}{\sigma_p^2} \quad \text{such that } \sum_{i=1}^N \text{MRC}_i = 1.0$$
$\text{MRC}_i$ quantifies the exact percentage of total portfolio volatility risk driven by asset $i$.

---

### 7. Position Sizing Recommendation
Volatility-targeted position sizing scales allocation inversely to asset risk:
$$\text{Volatility Scalar } s = \frac{\sigma_{\text{target}}}{\max(0.05, \sigma_{\text{ann}})}$$
$$\text{VaR Cap} = \frac{\text{Risk Budget \%}}{\text{VaR}_{95}^{\text{daily}}}$$
The recommended position cap is bounded strictly within $[2\%, 40\%]$ of portfolio capital, subject to severe drawdown penalties.

---

### 8. Composite Overall Risk Score & Classification
$$\text{Score} = 0.35 \cdot \text{Norm}(\sigma_{\text{ann}}) + 0.30 \cdot \text{Norm}(\text{VaR}_{95}) + 0.25 \cdot \text{Norm}(|\text{MDD}|) + 0.10 \cdot \text{Norm}(\text{CVaR}_{95})$$
Clamped strictly into $[0.05, 0.95]$.

| Risk Score Range | Categorical Rating | Characteristics |
| :--- | :--- | :--- |
| $\text{Score} < 0.28$ | `LOW` | Stable asset, moderate volatility, shallow drawdowns, low tail risk. |
| $0.28 \le \text{Score} < 0.58$ | `MODERATE` | Typical blue-chip crypto asset (BTC/ETH), standard market volatility. |
| $0.58 \le \text{Score} < 0.80$ | `HIGH` | Elevated volatility, sharp historical drawdowns, high beta. |
| $\text{Score} \ge 0.80$ | `CRITICAL` | Extreme tail risk, high leverage danger, severe historical capital loss. |

---

## 3. Architecture & Component Structure

```
backend/app/services/risk_engine/
├── __init__.py              # Module exports and singleton factory
├── var_calculator.py        # Parametric & Historical VaR and CVaR
├── drawdown_calculator.py   # MDD, current drawdown, duration
├── metrics_calculator.py    # Sharpe, Sortino, Calmar, Volatility, Beta
├── position_sizing.py       # Volatility-targeted position sizing limits
├── portfolio_risk.py        # Portfolio covariance, MRC, and HHI concentration
└── service.py               # RiskEngineService orchestrator and DB persistence
```

---

## 4. REST API Reference

### 1. `GET /api/v1/risk/{symbol}`
Evaluates comprehensive quantitative risk metrics for an individual asset.

#### Parameters
| Parameter | Location | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `symbol` | Path | string | Required | Trading pair symbol (e.g. `BTC/USDT`, `ETH`, `SOL`). |
| `timeframe` | Query | string | `1h` | Candle interval for returns (`15m`, `1h`, `4h`, `1d`). |
| `limit` | Query | integer | `100` | Lookback window ($30 \le \text{limit} \le 500$). |
| `benchmark` | Query | string | `BTC/USDT` | Reference asset for Beta and correlation. |

#### Sample Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "symbol": "BTC",
    "timestamp": "2026-09-19T13:38:12.123456Z",
    "overall_risk_score": 0.4215,
    "risk_level": "MODERATE",
    "volatility_daily": 0.0215,
    "volatility_annualized": 0.4107,
    "var_metrics": {
      "var_95_daily": 0.0345,
      "var_99_daily": 0.0488,
      "cvar_95_daily": 0.0432,
      "cvar_99_daily": 0.0561,
      "parametric_var_95": 0.0345,
      "historical_var_95": 0.0338,
      "parametric_cvar_95": 0.0432,
      "historical_cvar_95": 0.0415,
      "method": "CONSERVATIVE_HYBRID"
    },
    "drawdown_metrics": {
      "max_drawdown": -0.1852,
      "current_drawdown": -0.0412,
      "drawdown_duration_periods": 14,
      "peak_price": 68500.0,
      "trough_price": 55813.8
    },
    "risk_adjusted_metrics": {
      "sharpe_ratio": 1.452,
      "sortino_ratio": 2.104,
      "calmar_ratio": 3.421,
      "annualized_return": 0.6335,
      "annualized_volatility": 0.4107,
      "downside_deviation": 0.2821,
      "risk_free_rate": 0.04
    },
    "sensitivity_metrics": {
      "beta": 1.0,
      "correlation_with_benchmark": 1.0,
      "benchmark_symbol": "BTC/USDT"
    },
    "position_sizing": {
      "max_position_pct": 0.2435,
      "recommended_leverage": 1.0,
      "risk_budget_pct": 0.02,
      "volatility_scalar": 0.487,
      "rationale": "Volatility scalar (0.49x) against 20% target vol. Daily 95% VaR of 3.45% yields max safe allocation of 24.4% within a 2% risk budget."
    },
    "risk_warnings": [],
    "analysis_id": "8f3b6c24-11e4-4d22-b5e1-cf2849204821"
  },
  "metadata": {
    "request_id": "c7f66a2b-28f1-4328-8d45-667788990011",
    "symbol": "BTC",
    "overall_risk_score": 0.4215,
    "risk_level": "MODERATE",
    "volatility_annualized": 0.4107,
    "var_95_daily": 0.0345,
    "max_drawdown": -0.1852,
    "analysis_id": "8f3b6c24-11e4-4d22-b5e1-cf2849204821"
  }
}
```

---

### 2. `GET /api/v1/risk/{symbol}/history`
Retrieves chronological audit log of historical persisted risk evaluations for the asset.

---

### 3. `POST /api/v1/risk/portfolio`
Evaluates cross-asset covariance structure, portfolio-level VaR/CVaR, HHI concentration, Sharpe/Sortino ratios, and marginal risk contributions.

#### Request Body
```json
{
  "assets": [
    {"symbol": "BTC", "weight": 0.6},
    {"symbol": "ETH", "weight": 0.4}
  ],
  "benchmark_symbol": "BTC/USDT",
  "portfolio_name": "AlphaCore"
}
```

#### Sample Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "portfolio_id": null,
    "portfolio_name": "AlphaCore",
    "timestamp": "2026-09-19T13:38:15.654321Z",
    "overall_risk_score": 0.442,
    "risk_level": "MODERATE",
    "portfolio_volatility_annualized": 0.435,
    "portfolio_var_95_daily": 0.0362,
    "portfolio_cvar_95_daily": 0.0451,
    "portfolio_sharpe_ratio": 1.38,
    "portfolio_sortino_ratio": 1.95,
    "max_drawdown": -0.198,
    "concentration": {
      "hhi": 0.52,
      "normalized_hhi": 0.04,
      "effective_assets": 1.92,
      "top_asset_weight": 0.6,
      "asset_weights": {"BTC": 0.6, "ETH": 0.4}
    },
    "marginal_risk_contributions": {
      "BTC": 0.584,
      "ETH": 0.416
    },
    "component_risks": { ... },
    "risk_warnings": [],
    "analysis_id": "b182d3e4-8451-4190-b992-d34190382910"
  },
  "metadata": { ... }
}
```

---

### 4. `GET /api/v1/risk/portfolio/{portfolio_id}`
Loads a persisted user portfolio from the database and runs full quantitative risk modeling across its current holdings.

---

## 5. Automated Verification Suite

The Quantitative Risk Engine is covered by 16 targeted automated tests:

| Test File | Target Area | Test Cases |
| :--- | :--- | :--- |
| `tests/unit/test_risk_engine.py` | VaR & CVaR | Parametric & historical calculations, ordering ($CVaR \ge VaR$), edge cases. |
| `tests/unit/test_risk_engine.py` | Drawdown Dynamics | Max drawdown, current drawdown, peak/trough levels, monotonic price series. |
| `tests/unit/test_risk_engine.py` | Performance & Sensitivity | Sharpe, Sortino, Calmar, realized volatility, downside deviation, Beta & correlation. |
| `tests/unit/test_risk_engine.py` | Position Sizing | Volatility parity scaling, VaR constraint caps, safe leverage multipliers. |
| `tests/unit/test_risk_engine.py` | Portfolio Aggregation | HHI concentration, normalized HHI, effective asset count, marginal risk contributions. |
| `tests/unit/test_risk_engine.py` | Service Orchestration | End-to-end asset and portfolio evaluation, database persistence, score bounding ($0.05 \le s \le 0.95$). |
| `tests/api/test_risk.py` | REST API | Success envelope, custom parameters, history retrieval, portfolio endpoint, 404 validation, request ID preservation. |

Run tests:
```bash
pytest tests/unit/test_risk_engine.py tests/api/test_risk.py -v
```
