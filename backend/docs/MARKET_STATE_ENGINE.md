# Market State / Market Regime Intelligence Engine

## 1. Overview and Core Philosophy

The **Market State Intelligence Engine** provides quantitative regime classification for cryptocurrency assets within the GHOST platform. 

### Why Regimes Before Directional Signals?
A core failure mode of quantitative trading systems is applying trend-following or mean-reversion strategies irrespective of the broader macroeconomic and structural market regime. The Market State Engine decouples **market condition diagnostics** from **order execution / trading advice**:

- **No Premature Buy/Sell Signals**: The engine does not generate raw buy/sell recommendations. It determines the state of the market environment (e.g. `BULLISH_TREND`, `HIGH_VOLATILITY`, `ACCUMULATION_LIKE`, or `UNCERTAIN`).
- **Strict Evidence-Based Reasoning**: Every state classification is supported by an auditable trail of technical and microstructure indicator evidence items (`EvidenceItem`).
- **Conflict Awareness**: Financial markets frequently exhibit divergent signals (e.g., price trending upwards while the order book exhibits massive sell walls or momentum oscillators diverge). The engine detects and quantifies these contradictions.
- **Strictly Bounded Confidence ($0.05 \le c \le 0.95$)**: Confidence represents quantitative evidence strength and signal alignment—**never** trade winning probability or certainty. In financial markets, certainty does not exist; therefore, $c = 1.0$ is strictly prohibited.

---

## 2. The 8 Analytical Market Regimes

The engine classifies each asset at point-in-time $T$ into exactly one of eight mutually exclusive regimes:

| Regime | Structural Definition | Key Indicator Signatures |
| :--- | :--- | :--- |
| `BULLISH_TREND` | Sustained upward directional price discovery | $\text{EMA}_{12} > \text{EMA}_{26}$, $\text{SMA}_{20} > \text{SMA}_{50}$, $\text{Price} > \text{SMA}_{50}$, $\text{RSI}_{14} \ge 53$, $\text{MACD}_{\text{hist}} > 0$, $\text{Mom}_{10} > 0$. |
| `BEARISH_TREND` | Sustained downward directional price discovery | $\text{EMA}_{12} < \text{EMA}_{26}$, $\text{SMA}_{20} < \text{SMA}_{50}$, $\text{Price} < \text{SMA}_{50}$, $\text{RSI}_{14} \le 47$, $\text{MACD}_{\text{hist}} < 0$, $\text{Mom}_{10} < 0$. |
| `SIDEWAYS` | Directional equilibrium and range-bound oscillation | $\lvert\text{Trend Strength}\rvert \le 0.008$, $\text{RSI}_{14} \in [45, 55]$, $\lvert\text{Mom}_{10}\rvert \le 0.008$, tight Bollinger bandwidth ($0.028 < \text{BW} \le 0.045$). |
| `HIGH_VOLATILITY` | Elevated price dispersion and tail-risk turbulence | $\text{Bollinger Bandwidth} \ge 0.07$, Realized $\text{Vol}_{20} \ge 0.03$, $\text{ATR}_{14} / \text{Close} \ge 0.025$, Volume volatility $\ge 0.40$. |
| `LOW_VOLATILITY` | Extreme volatility compression / dormant squeeze | $\text{Bollinger Bandwidth} \le 0.028$, Realized $\text{Vol}_{20} \le 0.012$, $\text{ATR}_{14} / \text{Close} \le 0.010$. Precedes directional breakouts. |
| `ACCUMULATION_LIKE` | Institutional absorption and smart-money bid support | Order book bid imbalance $\ge +0.15$, $\text{RSI}_{14} \in [35, 52]$, Volume expanding ($\Delta \text{Vol} \ge 12\%$) without price drop, stabilizing post-pullback base. |
| `DISTRIBUTION_LIKE` | Overhead smart-money supply unloading into retail liquidity | Order book ask imbalance $\le -0.15$, $\text{RSI}_{14} \in [52, 72]$, Volume expanding ($\Delta \text{Vol} \ge 12\%$) with stalling/negative returns. |
| `UNCERTAIN` | Signal divergence, regime transitions, or inadequate evidence | Conflict score $\ge 0.30$ with small margin between conflicting regimes, or total evidence score $< 2.0$ across all regimes. |

---

## 3. Architecture and Quantitative Pipeline

The engine is engineered as a modular service layer located in `backend/app/services/market_state/`:

```
┌─────────────────────────────────────────────────────────┐
│              MarketDataService (Phase 4 & 5)            │
│       Fetches CanonicalCandles & CanonicalOrderBook     │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│               FeatureBuilder (Phase 6)                  │
│    Computes Zero-Lookahead Vectorized FeatureSnapshot   │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│            RuleBasedMarketStateClassifier               │
│  1. Evaluate Evidence Items (_evaluate_evidence)       │
│  2. Aggregate State Evidence Scores (_aggregate_scores) │
│  3. ConflictAnalyzer.analyze_conflicts                 │
│  4. Regime Arbitration (Top Score vs Uncertainty)       │
│  5. Bounded Confidence Calibration [0.05, 0.95]         │
│  6. Narrative Rationale Synthesis                      │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   MarketStateResult                     │
│       Returned via GET /api/v1/intelligence/{symbol}/state│
└─────────────────────────────────────────────────────────┘
```

### Module Responsibilities:
1. `app/schemas/market_state.py`: Defines `MarketState`, `EvidenceItem`, `MarketStateScores`, and `MarketStateResult` with Pydantic v2 validation.
2. `app/services/market_state/base.py`: Defines the abstract interface `MarketStateClassifier(ABC)` with `classify(snapshot, timeframe)`.
3. `app/services/market_state/evidence.py`: Implements `ConflictAnalyzer` to detect and quantify contradictory directional or structural signals.
4. `app/services/market_state/rule_based.py`: Implements `RuleBasedMarketStateClassifier` and configurable `MarketStateThresholds`.
5. `app/services/market_state/service.py`: Orchestrates market data retrieval, feature generation, and classification via `MarketStateService`.
6. `app/api/v1/routes/intelligence.py`: Exposes `GET /api/v1/intelligence/{symbol}/state`.

---

## 4. Conflict Analysis and Bounded Confidence Formulation

### Conflict Detection Matrix
The `ConflictAnalyzer` monitors five primary vectors of signal divergence:
1. **Direct Trend Divergence**: Coexistence of strong bullish moving averages with strong bearish moving averages (e.g. short MA up, long MA down).
2. **Momentum Divergence**: Positive trend strength with plunging RSI / negative MACD histogram, or negative trend strength with surging RSI / positive MACD histogram.
3. **Microstructure Divergence**: Bullish price trend conflicting with heavy order book ask walls ($\text{Imbalance} \le -0.25$), or bearish trend conflicting with heavy bid support ($\text{Imbalance} \ge +0.25$).
4. **Volatility Divergence**: Volatility envelope expansion conflicting with compression metrics.
5. **Sideways Ambiguity**: Consolidation metrics competing with directional trend indicators.

A composite `conflict_score` $\in [0.0, 1.0]$ is computed. If `conflict_score >= 0.30` and the margin between the top two candidate regimes is within the uncertainty margin ($\Delta < 0.8$), the regime resolves to `MarketState.UNCERTAIN`.

### Confidence Score Formulation
Confidence is mathematically bounded to the interval $[0.05, 0.95]$:

$$\text{Margin} = \max(0.0, S_{\text{winner}} - S_{\text{runner\_up}})$$

$$\text{Base Confidence} = 0.40 + 0.30 \cdot \min\left(1.0, \frac{S_{\text{winner}}}{6.0}\right) + 0.18 \cdot \min\left(1.0, \frac{\text{Margin}}{\max(S_{\text{winner}}, 1.0)}\right)$$

$$\text{Penalized Confidence} = \text{Base Confidence} \cdot (1.0 - 0.45 \cdot \text{Conflict Score})$$

$$\text{Final Confidence} = \max(0.05, \min(0.95, \text{Penalized Confidence}))$$

For `UNCERTAIN` classifications, confidence reflects the certainty of the ambiguity:
$$\text{Confidence} = \max(0.05, \min(0.48, 0.20 + 0.25 \cdot \text{Conflict Score}))$$

---

## 5. REST API Specification

### Endpoint
`GET /api/v1/intelligence/{symbol}/state`

#### Query Parameters:
- `timeframe` (optional, string, default `"1h"`): Candle interval (e.g., `15m`, `1h`, `4h`, `1d`).
- `limit` (optional, integer, default `100`, range `[5, 500]`): Historical candles for warmup periods.

#### Response Envelope:
```json
{
  "success": true,
  "data": {
    "symbol": "BTC",
    "timestamp": "2026-09-19T13:20:00Z",
    "state": "BULLISH_TREND",
    "confidence": 0.7925,
    "primary_rationale": "Classified as BULLISH_TREND with confidence 0.79 based on strong quantitative evidence (score: 5.20). Primary supporting indicators: EMA_12_26_ALIGNMENT, SMA_20_50_ALIGNMENT, TREND_STRENGTH.",
    "conflict_detected": false,
    "conflict_score": 0.0,
    "evidence": [
      {
        "indicator": "EMA_12_26_ALIGNMENT",
        "value": 1250.5,
        "condition": "EMA_12 > EMA_26",
        "interpretation": "Short-term exponential moving average above medium-term average indicates bullish bias.",
        "supports_state": "BULLISH_TREND",
        "weight": 1.0
      },
      {
        "indicator": "SMA_20_50_ALIGNMENT",
        "value": 2400.0,
        "condition": "SMA_20 > SMA_50 and Close > SMA_50",
        "interpretation": "Price and short-term SMA above 50-period SMA confirms upward trend posture.",
        "supports_state": "BULLISH_TREND",
        "weight": 1.2
      },
      {
        "indicator": "TREND_STRENGTH",
        "value": 0.038,
        "condition": ">= 0.01",
        "interpretation": "Positive moving average separation signals established bullish trend.",
        "supports_state": "BULLISH_TREND",
        "weight": 1.0
      },
      {
        "indicator": "RSI_14",
        "value": 61.4,
        "condition": ">= 53.0",
        "interpretation": "RSI (61.4) in bullish momentum zone.",
        "supports_state": "BULLISH_TREND",
        "weight": 1.0
      },
      {
        "indicator": "MACD_HISTOGRAM",
        "value": 45.2,
        "condition": "MACD > Signal and Hist > 0",
        "interpretation": "Positive MACD histogram indicates upward momentum acceleration.",
        "supports_state": "BULLISH_TREND",
        "weight": 1.0
      }
    ],
    "state_scores": {
      "BULLISH_TREND": 5.2,
      "BEARISH_TREND": 0.0,
      "SIDEWAYS": 0.0,
      "HIGH_VOLATILITY": 0.0,
      "LOW_VOLATILITY": 0.0,
      "ACCUMULATION_LIKE": 0.0,
      "DISTRIBUTION_LIKE": 0.0,
      "UNCERTAIN": 0.0
    },
    "timeframe": "1h",
    "warmup_periods_used": 100
  },
  "metadata": {
    "request_id": "req-98f21914-7221-4ba2-8d7e-128a9b2fc631",
    "symbol": "BTC",
    "state": "BULLISH_TREND",
    "confidence": 0.7925,
    "conflict_detected": false
  }
}
```

---

## 6. Downstream Integration with Phase 8 (Signal Engine)

In Phase 8, the Signal Engine consumes the output of `MarketStateService`:
- **Regime-Conditional Signal Generation**: Trend-following models (e.g., breakouts, moving average crosses) are active **only** when `state == BULLISH_TREND` or `state == BEARISH_TREND`.
- **Mean-Reversion & Range Strategies**: Active **only** when `state == SIDEWAYS` or `state == LOW_VOLATILITY`.
- **Smart Money Entry/Exit Strategies**: Active **only** when `state == ACCUMULATION_LIKE` or `state == DISTRIBUTION_LIKE`.
- **Trading Suspension & Hedging**: When `state == UNCERTAIN` or `state == HIGH_VOLATILITY`, trading strategies reduce position sizing, tighten stops, or suspend new order generation until regime clarity resumes.
