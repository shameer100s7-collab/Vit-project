# Quantitative Signal Engine

## 1. Overview and Core Philosophy

The **Quantitative Signal Engine** is the multi-strategy consensus layer of the GHOST platform. 

It consumes:
1. **Engineered Quantitative Features** from `FeatureBuilder` (Phase 6).
2. **Analytical Macro Market Regimes** from `MarketStateService` (Phase 7).

And produces structured, explainable, and multi-model consensus trading recommendations:
- **Supported Directions**: `LONG`, `SHORT`, `HOLD`, `NEUTRAL`.
- **Supported Time Horizons**: `VERY_SHORT_TERM`, `SHORT_TERM`, `MEDIUM_TERM`, `LONG_TERM`.
- **Ensemble Consensus**: Aggregates heterogeneous quantitative strategies with dynamic regime weights.
- **Domination Prevention**: No single strategy can exert more than 35% of total ensemble influence.
- **Zero-Black-Box Explainability**: Every aggregated signal includes the full, transparent breakdown of contributing individual strategy signals, reasonings, and consensus metrics.
- **Bounded Confidence ($0.05 \le c \le 0.95$)**: Enforces mathematical bounds where certainty does not exist.

---

## 2. Quantitative Strategy Suite

The Signal Engine deploys five independent quantitative strategy models located in `backend/app/services/signal_engine/`:

### 1. `TechnicalStrategy` (`technical.py`)
- **Philosophy**: Trend persistence and moving average structure.
- **Indicators Consumed**: $\text{EMA}_{12}$, $\text{EMA}_{26}$, $\text{SMA}_{20}$, $\text{SMA}_{50}$, $\text{Price}$, $\text{Trend Strength}$.
- **Rules**:
  - `LONG`: $\text{EMA}_{12} > \text{EMA}_{26}$ and $\text{Price} > \text{SMA}_{50}$ with positive trend strength.
  - `SHORT`: $\text{EMA}_{12} < \text{EMA}_{26}$ and $\text{Price} < \text{SMA}_{50}$ with negative trend strength.
  - `HOLD` / `NEUTRAL`: Moving averages conflicting or flat.

### 2. `MomentumStrategy` (`momentum.py`)
- **Philosophy**: Velocity and oscillator acceleration.
- **Indicators Consumed**: $\text{RSI}_{14}$, $\text{MACD}$, $\text{MACD}_{\text{signal}}$, $\text{MACD}_{\text{hist}}$, $\text{Momentum}_{10}$.
- **Rules**:
  - `LONG`: Positive MACD histogram expansion, $\text{RSI}_{14} \in [53, 72]$, positive 10-period price velocity.
  - `SHORT`: Negative MACD histogram expansion, $\text{RSI}_{14} \in [28, 47]$, negative 10-period price velocity.
  - Caution: Extreme RSI ($> 75$ or $< 25$) warns of climactic exhaustion.

### 3. `MeanReversionStrategy` (`mean_reversion.py`)
- **Philosophy**: Statistical exhaustion and envelope bounce.
- **Indicators Consumed**: $\text{RSI}_{14}$, $\text{Drawdown}$, $\text{Bollinger Bandwidth}$.
- **Rules**:
  - `LONG`: Deep oversold exhaustion ($\text{RSI}_{14} \le 32$ or $\text{Drawdown} \le -6\%$ with $\text{RSI}_{14} \le 38$).
  - `SHORT`: Overbought exhaustion ($\text{RSI}_{14} \ge 68$ at resistance).
  - **Regime Defense**: If macro market is in an established `BULLISH_TREND` or `BEARISH_TREND`, mean reversion is **actively suppressed** to `HOLD` to prevent counter-trend catastrophic losses.

### 4. `VolatilityStrategy` (`volatility.py`)
- **Philosophy**: Volatility regime transitions and tail-risk defense.
- **Indicators Consumed**: $\text{Bollinger Bandwidth}$, Realized $\text{Volatility}_{20}$, $\text{ATR}_{14} / \text{Price}$, $\text{Momentum}_{10}$.
- **Rules**:
  - `HOLD`: When $\text{Bandwidth} \ge 0.080$ or realized $\text{Volatility}_{20} \ge 0.040$ (tail-risk defense against market turbulence).
  - Breakout `LONG`/`SHORT`: When $\text{Bandwidth} \le 0.028$ (volatility squeeze) followed by lead momentum expansion.

### 5. `MultiFactorMLStrategy` (`ml_signal.py`)
- **Philosophy**: Statistical multi-factor cross-sectional scoring.
- **Factors Combined**:
  $$\text{Score} = 0.35 \cdot F_{\text{trend}} + 0.30 \cdot F_{\text{momentum}} + 0.25 \cdot F_{\text{microstructure}} + 0.10 \cdot F_{\text{drawdown}}$$
- **Rules**:
  - `LONG`: $\text{Score} \ge +0.20$.
  - `SHORT`: $\text{Score} \le -0.20$.
  - `NEUTRAL`: $\lvert\text{Score}\rvert < 0.20$.

---

## 3. Dynamic Regime-Conditioned Weighting

The `SignalAggregator` adapts individual strategy weights dynamically based on the current regime identified by Phase 7 (`MarketStateService`):

| Market Regime | Strategy Weight Adjustments | Rationale |
| :--- | :--- | :--- |
| `BULLISH_TREND` / `BEARISH_TREND` | Technical $\times 1.30$, Momentum $\times 1.25$, MeanReversion $\times 0.50$ | Trends reward continuation; counter-trend mean reversion penalized. |
| `SIDEWAYS` | MeanReversion $\times 1.40$, Technical $\times 0.70$, Momentum $\times 0.70$ | Oscillations within boundaries favor mean reversion. |
| `HIGH_VOLATILITY` | Volatility $\times 1.50$, Technical $\times 0.75$, Momentum $\times 0.75$ | Tail risk and dispersion require risk-mitigating volatility defense. |
| `LOW_VOLATILITY` | Volatility $\times 1.30$, Momentum $\times 1.20$ | Dormant compression prepares for explosive directional breakout. |
| `UNCERTAIN` | All weights discounted by $15\%$, conflict penalty applied | Macro ambiguity commands reduced sizing and conservative bias. |

### Domination Prevention Guarantee
To prevent any single strategy model from silently dominating the ensemble, a strict mathematical cap is enforced:
$$\frac{w_i}{\sum_j w_j} \le 0.35 \quad \forall i$$
If any strategy's weight exceeds 35% of the total ensemble weight, it is clamped to $M / (1 - M) \cdot \sum_{j \ne i} w_j$.

---

## 4. Consensus Formulation & Confidence Calibration

### 1. Directional Scoring
For each candidate direction $D \in \{\text{LONG}, \text{SHORT}, \text{HOLD}, \text{NEUTRAL}\}$:
$$\text{Score}(D) = \sum_{s \in \text{strategies}, \text{dir}(s) = D} w_s \cdot \text{strength}(s) \cdot \text{confidence}(s)$$

### 2. Agreement Ratio
$$\text{Agreement Ratio} = \frac{N_{\text{agreeing strategies}}}{N_{\text{total strategies}}}$$

### 3. Bounded Confidence
$$\text{Margin} = \max(0.0, \text{Score}_{\text{winner}} - \text{Score}_{\text{runner\_up}})$$
$$\text{Base Confidence} = 0.42 + 0.32 \cdot \text{Agreement Ratio} + 0.16 \cdot \min\left(1.0, \frac{\text{Margin}}{\max(\text{Score}_{\text{winner}}, 1.0)}\right)$$
$$\text{Confidence} = \max(0.05, \min(0.95, \text{Base Confidence} \cdot (1.0 - \text{Regime Penalty})))$$

---

## 5. REST API Specification

### 1. Live Consensus Signal
- **Endpoint**: `GET /api/v1/signals/{symbol}`
- **Query Parameters**:
  - `timeframe` (optional, default `"1h"`): Candle interval (`15m`, `1h`, `4h`, `1d`).
  - `limit` (optional, default `100`, range `[5, 500]`): Lookback period.

#### Sample JSON Response:
```json
{
  "success": true,
  "data": {
    "asset": "BTC",
    "timestamp": "2026-09-19T13:28:00Z",
    "direction": "LONG",
    "confidence": 0.8124,
    "strength": 0.6540,
    "time_horizon": "MEDIUM_TERM",
    "market_state": "BULLISH_TREND",
    "reasons": [
      "Consensus: 4 of 5 strategies align on LONG (agreement ratio: 80%)",
      "Contributing strategies: TechnicalStrategy, MomentumStrategy, VolatilityStrategy, MultiFactorMLStrategy",
      "TechnicalStrategy: Fast EMA (12) trades above Slow EMA (26)",
      "MomentumStrategy: MACD line above signal with positive histogram expansion"
    ],
    "strategy_signals": [
      {
        "strategy_name": "TechnicalStrategy",
        "asset": "BTC",
        "direction": "LONG",
        "confidence": 0.79,
        "strength": 0.70,
        "time_horizon": "MEDIUM_TERM",
        "reasons": [
          "Fast EMA (12) trades above Slow EMA (26)",
          "Price and 20 SMA hold structural support above 50 SMA"
        ],
        "metrics": {
          "ema_diff": 1250.0,
          "sma_diff": 2400.0,
          "trend_strength": 0.045
        }
      },
      {
        "strategy_name": "MomentumStrategy",
        "asset": "BTC",
        "direction": "LONG",
        "confidence": 0.82,
        "strength": 0.72,
        "time_horizon": "SHORT_TERM",
        "reasons": [
          "MACD line above signal with positive histogram expansion",
          "RSI (64.0) in active bullish acceleration corridor"
        ],
        "metrics": {
          "rsi_14": 64.0,
          "macd_hist": 45.0,
          "momentum_10": 0.038
        }
      },
      {
        "strategy_name": "MeanReversionStrategy",
        "asset": "BTC",
        "direction": "HOLD",
        "confidence": 0.70,
        "strength": 0.15,
        "time_horizon": "SHORT_TERM",
        "reasons": [
          "Mean reversion actively suppressed during established BULLISH_TREND",
          "Counter-trend entries carry severe asymmetric drawdown risk"
        ],
        "metrics": {
          "rsi_14": 64.0,
          "drawdown": 0.0,
          "bb_bandwidth": 0.045
        }
      },
      {
        "strategy_name": "VolatilityStrategy",
        "asset": "BTC",
        "direction": "LONG",
        "confidence": 0.72,
        "strength": 0.65,
        "time_horizon": "SHORT_TERM",
        "reasons": [
          "Directional bias resolves upward with positive lead momentum"
        ],
        "metrics": {
          "bb_bandwidth": 0.045,
          "volatility_20": 0.022,
          "atr_pct": 0.018
        }
      },
      {
        "strategy_name": "MultiFactorMLStrategy",
        "asset": "BTC",
        "direction": "LONG",
        "confidence": 0.78,
        "strength": 0.68,
        "time_horizon": "MEDIUM_TERM",
        "reasons": [
          "Multi-factor score: +0.420 across trend, momentum, and orderbook factors"
        ],
        "metrics": {
          "composite_score": 0.42,
          "factor_trend": 0.70,
          "factor_momentum": 0.56,
          "factor_microstructure": 0.25
        }
      }
    ],
    "consensus_metrics": {
      "vote_counts": {
        "LONG": 4,
        "SHORT": 0,
        "HOLD": 1,
        "NEUTRAL": 0
      },
      "direction_scores": {
        "LONG": 1.745,
        "SHORT": 0.0,
        "HOLD": 0.075,
        "NEUTRAL": 0.0
      },
      "agreement_ratio": 0.80,
      "strategies_evaluated": 5,
      "effective_weights": {
        "TechnicalStrategy": 0.2955,
        "MomentumStrategy": 0.2841,
        "MeanReversionStrategy": 0.1136,
        "VolatilityStrategy": 0.2273,
        "MultiFactorMLStrategy": 0.2273
      }
    },
    "timeframe": "1h",
    "model_version": "v1.0"
  },
  "metadata": {
    "request_id": "req-d3e91823-1492-482a-a928-89f182c471a2",
    "symbol": "BTC",
    "direction": "LONG",
    "confidence": 0.8124,
    "strength": 0.6540,
    "market_state": "BULLISH_TREND"
  }
}
```

### 2. Historical Signal Log
- **Endpoint**: `GET /api/v1/signals/{symbol}/history`
- **Query Parameters**:
  - `limit` (optional, default `50`, range `[1, 200]`): Max historical signals.
- Returns list of historical persisted signals from `signals` table for auditing and performance attribution.

---

## 6. Downstream Feed into Phase 9 & 10

1. **Behavior / Game-Theoretic Model (Phase 9)**:
   - Evaluates whether observable whale / institutional participant behavior aligns with or opposes the consensus signal direction.
2. **Quantitative Risk Engine (Phase 10)**:
   - Consumes signal confidence and strength to size positions dynamically, calculate Value at Risk (VaR), and ensure concentration and liquidity limits are never breached before any portfolio allocation occurs.
