# Observable-Behavior & Game-Theoretic Analysis Model

## 1. Overview and Core Philosophy

The **Observable-Behavior and Game-Theoretic Analysis Model** constitutes the market microstructure and participant inference layer of the GHOST platform.

### Strict Epistemological Foundation
Traditional crypto analysis often succumbs to anthropomorphic speculation, attributing conscious "intent", "greed", or "fear" to anonymous market participants. The GHOST Behavior Model rejects speculative mind-reading in favor of an **observable-behavior framework**:
1. **Observable Facts Only**: All factual observations (`ObservationItem`) are calculated strictly from observable order book depth, resting limit walls, spread, volume concentration, and price velocity.
2. **Probabilistic Model Inferences**: Participant archetypes and behavioral states are modeled strictly as **probabilistic hypotheses** conditioned on verifiable microstructure mechanics.
3. **Strict Bounded Confidence ($0.05 \le c \le 0.95$)**: In complex adaptive systems, deterministic certainty does not exist. Confidence scores are strictly bounded between 5% and 95% ($0.05 \le c \le 0.95$), preventing both false certainty ($1.0$) and dogmatic impossibility ($0.0$).
4. **Game-Theoretic Dynamics**: Market states are analyzed as asymmetric non-zero-sum coordination and confrontation games between liquidity suppliers, directional aggregators, algorithmic arbitrageurs, and uninformed retail flows.

---

## 2. Behavioral Regimes & States

The model evaluates order book microstructure and price action to classify the market into one of eight observable behavioral states:

| Behavioral State | Key Observable Fingerprints | Game-Theoretic Dynamics |
| :--- | :--- | :--- |
| `ACCUMULATION_LIKE` | High bid depth asymmetry ($> +0.25$), heavy bid walls, elevated volume absorption with low price displacement. | Aggressive absorption of available sell liquidity by large entities without allowing price to appreciate aggressively. |
| `DISTRIBUTION_LIKE` | High ask depth asymmetry ($< -0.25$), heavy ask walls, high volume with upward exhaustion or downward drift. | Systematic offloading of inventory into bid liquidity, creating ceiling resistance and bid depletion. |
| `LIQUIDITY_HUNTING` | Tight spread, asymmetric depth pullbacks near local extremes, sudden volume bursts through thin liquidity shelves. | Liquidity seekers or stop-hunts driving price toward resting liquidity pockets to trigger clustered liquidations or fills. |
| `RETAIL_FOMO` | Extreme upside momentum, high volume, low resting bid depth (fragile chasing), widening spreads. | Uncoordinated momentum chasing across aggressive market orders, leaving thin depth support below. |
| `RETAIL_PANIC` | Extreme downside momentum, violent volume spikes, depleted bid depth, widening spreads. | Inelastic market sell liquidations absorbing bids, resulting in liquidity vacuums and elevated slip. |
| `MARKET_MAKING_BALANCED` | Balanced depth asymmetry ($\approx 0.0$), tight bid-ask spread ($\le 3.5$ bps), stable depth resilience. | Competitive quoting by market makers earning the spread; two-sided inventory turnover in equilibrium. |
| `NEUTRAL_INACTIVE` | Low volume, low volatility, moderate and stable spreads, balanced order book. | Dormant participation; absence of aggressive directional flows or inventory repositioning. |
| `UNCERTAIN` | Conflicting indicators, anomalous depth spikes without volume, or insufficient microstructure history. | Ambiguous game state where no participant hypothesis achieves dominant probabilistic weight. |

---

## 3. Market Participant Archetypes

The model assesses five distinct archetypes by evaluating observable fingerprints rather than identities:

### 1. `RETAIL_TRADERS`
- **Fingerprints**: Uncoordinated aggressive market orders, directional volume clusters following price spikes, low resting depth contribution, susceptibility to momentum chasing and panic selling.
- **Microstructure Indicators**: High momentum velocity coupled with low book depth resilience.

### 2. `LARGE_HOLDERS_WHALES`
- **Fingerprints**: Large resting limit walls ($\ge 3.0 \times$ average depth), high volume absorption ratios, elevated volume concentration in single blocks.
- **Microstructure Indicators**: Detected limit walls on bids/asks, order book asymmetry, absorption ratio $> 1.8$.

### 3. `INSTITUTIONAL_FLOW`
- **Fingerprints**: Steady, time-sliced execution (TWAP/VWAP-like footprint), high volume with minimal price slippage, structured inventory absorption across multiple depth tiers.
- **Microstructure Indicators**: High volume absorption with low realized volatility and balanced spreads.

### 4. `LIQUIDITY_PROVIDERS`
- **Fingerprints**: Tight spreads ($\le 3.5$ bps), symmetric bid/ask depth tiers, rapid order book resilience (replenishment post-trade).
- **Microstructure Indicators**: Low spread in bps, depth asymmetry near zero, high depth resilience score ($\ge 0.70$).

### 5. `ALGORITHMIC_HFT`
- **Fingerprints**: Micro-second quote adjustments, minimal duration of resting orders, razor-thin spreads, high trade frequency relative to notional depth.
- **Microstructure Indicators**: Ultra-tight spreads ($< 2.0$ bps) and rapid depth fluctuations.

---

## 4. Mathematical Formulations

### 1. Order Book Depth Asymmetry
Measures the directional balance of resting liquidity across the top $N$ levels:
$$\text{Depth Asymmetry} = \frac{\sum_{i=1}^N \text{BidSize}_i - \sum_{i=1}^N \text{AskSize}_i}{\sum_{i=1}^N \text{BidSize}_i + \sum_{i=1}^N \text{AskSize}_i} \in [-1.0, 1.0]$$
- $+1.0$: Complete bid domination (heavy support or resting accumulation walls).
- $-1.0$: Complete ask domination (heavy resistance or resting distribution walls).
- $0.0$: Perfectly balanced two-sided liquidity.

### 2. Net Order Book Imbalance
$$\text{Net Imbalance} = \sum_{i=1}^N \text{BidSize}_i - \sum_{i=1}^N \text{AskSize}_i$$

### 3. Effective Spread in Basis Points
Measures market friction and liquidity supplier compensation:
$$\text{Spread (bps)} = \frac{\text{Ask}_0 - \text{Bid}_0}{\text{Mid Price}} \times 10{,}000$$
where $\text{Mid Price} = \frac{\text{Ask}_0 + \text{Bid}_0}{2}$.

### 4. Depth Resilience
Quantifies the depth density relative to total book volume, modeling how readily the book absorbs order flow:
$$\text{Resilience} = \max\left(0.10, \min\left(0.95, \frac{\text{Total Depth}}{\text{Total Depth} + 10 \cdot \overline{\text{Level Depth}}}\right)\right)$$

### 5. Large Resting Limit Wall Detection
A price level $p_k$ is flagged as a large resting limit wall if:
$$\text{Size}(p_k) \ge \theta_{\text{wall}} \cdot \overline{\text{Size}}_{\text{depth}}$$
where threshold $\theta_{\text{wall}} = 3.0$ and $\overline{\text{Size}}_{\text{depth}} = \frac{1}{N}\sum_{i=1}^N \text{Size}_i$.
- Multiple walls are tallied: `large_resting_walls_count`.
- Wall locations are captured as structured objects: `{"side": "bid"|"ask", "price": float, "size": float, "ratio_to_avg": float}`.

### 6. Volume Concentration Ratio
Quantifies the proportion of order book liquidity held in the top 3 levels versus the entire visible book:
$$\text{Concentration Ratio} = \frac{\sum_{i=1}^{\min(3, N)} (\text{BidSize}_i + \text{AskSize}_i)}{\sum_{i=1}^N (\text{BidSize}_i + \text{AskSize}_i)}$$

### 7. Volume Absorption Ratio
Measures volume traded per unit of price displacement, revealing stealth accumulation or distribution:
$$\text{Absorption Ratio} = \frac{\text{Normalized Volume}}{\max(0.0001, \text{Normalized Price Range})}$$
A high absorption ratio during sideways price action indicates aggressive institutional absorption without price impact.

---

## 5. Confidence Calibration & Bounds

To ensure scientific rigor and risk-managed downstream consumption, all confidence scores are mathematically bounded:
$$0.05 \le c \le 0.95$$

### Bounding Rationale
- **Upper Bound ($0.95$)**: No empirical model has complete visibility into off-exchange OTC flows, internal exchange matching engines, or hidden iceberg orders. Absolute certainty ($1.0$) is mathematically ungrounded.
- **Lower Bound ($0.05$)**: Complete impossibility ($0.0$) disregards black swan tail distributions and microstructure regime shifts.

Confidence is derived from:
1. Convergence of multiple independent microstructure signals (asymmetry, walls, absorption, spread).
2. Alignment with macro market regime context (Phase 7).
3. Penalties for conflicting depth and price signals.

---

## 6. Architecture & Component Structure

```
backend/app/services/behavior_model/
├── __init__.py           # Package exports
├── liquidity_model.py    # Order book depth asymmetry, spreads, resilience
├── whale_activity.py     # Resting limit walls, volume concentration, absorption
├── participant_model.py  # Archetype scoring, state classification, bounded confidence
└── service.py            # BehaviorModelService orchestrator and singleton factory
```

### Data Pipeline Flow
```
CanonicalOrderBook + FeatureSnapshot + MarketStateResult
                        │
                        ▼
           ┌─────────────────────────┐
           │ LiquidityModelEvaluator │ ──► LiquidityPressure
           └─────────────────────────┘
                        │
                        ▼
           ┌─────────────────────────┐
           │ WhaleActivityEvaluator  │ ──► WhaleActivityIndicator
           └─────────────────────────┘
                        │
                        ▼
           ┌─────────────────────────┐
           │ ParticipantModelEngine  │ ──► ParticipantActivity[]
           └─────────────────────────┘      + Primary State + Bounded Confidence
                        │
                        ▼
           ┌─────────────────────────┐
           │ BehaviorModelService    │ ──► BehaviorAnalysisResult
           └─────────────────────────┘
```

---

## 7. REST API Reference

### `GET /api/v1/behavior/{symbol}`

Calculates and returns the observable-behavior and game-theoretic analysis for the specified cryptocurrency asset.

#### Headers
| Header | Type | Description |
| :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT>` | Optional. Enhances logging context. |

#### Path Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `symbol` | `string` | Yes | Unified trading pair (e.g. `BTC/USDT`, `ETH/USDT`, `SOL/USDT`). |

#### Response Schema (`200 OK`)
```json
{
  "symbol": "BTC/USDT",
  "timestamp": "2026-09-19T13:28:45.123456Z",
  "primary_behavior_state": "ACCUMULATION_LIKE",
  "state_confidence": 0.82,
  "observations": [
    {
      "metric": "order_book_depth_asymmetry",
      "observed_value": 0.425,
      "unit": "ratio",
      "context": "Positive value indicates bid depth predominance over ask depth",
      "is_factual": true
    },
    {
      "metric": "spread_bps",
      "observed_value": 1.85,
      "unit": "bps",
      "context": "Tight spread indicates active market making quoting",
      "is_factual": true
    },
    {
      "metric": "large_resting_walls_count",
      "observed_value": 3.0,
      "unit": "count",
      "context": "Resting limit levels exceeding 3.0x average level depth",
      "is_factual": true
    },
    {
      "metric": "absorption_ratio",
      "observed_value": 2.34,
      "unit": "ratio",
      "context": "Volume traded per unit of price displacement",
      "is_factual": true
    }
  ],
  "liquidity_pressure": {
    "depth_asymmetry": 0.425,
    "bid_depth_total": 45.28,
    "ask_depth_total": 18.32,
    "net_imbalance": 26.96,
    "spread_bps": 1.85,
    "depth_resilience": 0.81
  },
  "whale_activity": {
    "whale_activity_score": 0.76,
    "large_resting_walls_count": 3,
    "volume_concentration_ratio": 0.62,
    "absorption_ratio": 2.34,
    "detected_walls": [
      {
        "side": "bid",
        "price": 64800.0,
        "size": 12.5,
        "ratio_to_avg": 4.1
      }
    ]
  },
  "participant_inferences": [
    {
      "archetype": "LARGE_HOLDERS_WHALES",
      "activity_level": "HIGH",
      "dominance_score": 0.78,
      "observed_patterns": [
        "Heavy resting bid walls absorbing sell liquidity",
        "Elevated absorption ratio with low price downward displacement"
      ]
    },
    {
      "archetype": "LIQUIDITY_PROVIDERS",
      "activity_level": "MODERATE",
      "dominance_score": 0.65,
      "observed_patterns": [
        "Bid-ask spread maintained within 2.0 bps"
      ]
    },
    {
      "archetype": "RETAIL_TRADERS",
      "activity_level": "LOW",
      "dominance_score": 0.30,
      "observed_patterns": [
        "Subdued retail aggressive market flow"
      ]
    },
    {
      "archetype": "INSTITUTIONAL_FLOW",
      "activity_level": "HIGH",
      "dominance_score": 0.72,
      "observed_patterns": [
        "Systematic inventory accumulation patterns"
      ]
    },
    {
      "archetype": "ALGORITHMIC_HFT",
      "activity_level": "MODERATE",
      "dominance_score": 0.58,
      "observed_patterns": [
        "High quote frequency observed across top 5 depth levels"
      ]
    }
  ],
  "game_theoretic_summary": "Order book asymmetry (+0.42) and 3 large resting bid walls indicate active inventory absorption. Observed volume absorption ratio (2.34) suggests strategic accumulation while maintaining price stability.",
  "regime_context": "BULLISH_TREND"
}
```

#### Error Responses
- `400 Bad Request`: `{"detail": "Symbol is required"}`
- `404 Not Found`: `{"detail": "Asset symbol not found or insufficient market depth"}`
- `500 Internal Server Error`: `{"detail": "Behavior model processing failed: <reason>"}`

---

## 8. Automated Test Suite

The model is verified with 100% test coverage across both unit tests and end-to-end API route tests:

| Test File | Target | Test Cases |
| :--- | :--- | :--- |
| `tests/unit/test_behavior_model.py` | `LiquidityModelEvaluator` | Depth asymmetry calculation, net imbalance, spread in bps, depth resilience. |
| `tests/unit/test_behavior_model.py` | `WhaleActivityEvaluator` | Wall detection, volume concentration, absorption ratio. |
| `tests/unit/test_behavior_model.py` | `ParticipantModelEngine` | Archetype scoring, state classification (`ACCUMULATION_LIKE`, `DISTRIBUTION_LIKE`, `RETAIL_FOMO`, `MARKET_MAKING_BALANCED`), bounded confidence ($0.05 \le c \le 0.95$). |
| `tests/unit/test_behavior_model.py` | `BehaviorModelService` | End-to-end service orchestration, observation decoupling, schema validation. |
| `tests/api/test_behavior.py` | `GET /api/v1/behavior/{symbol}` | Valid symbol response, schema compliance, factual observation check, boundary confidence assertion, 404 on unresolvable symbol. |

To execute the test suite:
```bash
pytest tests/unit/test_behavior_model.py tests/api/test_behavior.py -v
```
