"""Large-block whale activity detection and volume concentration footprinting."""

from typing import List, Optional, Tuple

from app.schemas.behavior import ObservationItem, WhaleActivityIndicator
from app.schemas.features import FeatureSnapshot
from app.schemas.market import CanonicalOrderBook


class WhaleActivityDetector:
    """Detects observable footprints of large participants, block orders, and volume absorption."""

    @staticmethod
    def detect_whale_activity(
        snapshot: FeatureSnapshot,
        orderbook: Optional[CanonicalOrderBook],
    ) -> Tuple[WhaleActivityIndicator, List[ObservationItem]]:
        """Evaluates volume concentration and resting limit order clusters."""
        observations: List[ObservationItem] = []
        f = snapshot.features

        volume_change = f.get("volume_change", 0.0)
        volume_volatility = f.get("volume_volatility_20", 0.15)
        returns = f.get("returns", 0.0)
        orderbook_imbalance = f.get("orderbook_imbalance", 0.0)

        # 1. Limit Order Wall Detection
        wall_detected = False
        wall_side: Optional[str] = None

        if orderbook and orderbook.bids and orderbook.asks:
            total_bid = sum(b.quantity for b in orderbook.bids)
            total_ask = sum(a.quantity for a in orderbook.asks)

            max_bid = max(b.quantity for b in orderbook.bids) if orderbook.bids else 0.0
            max_ask = max(a.quantity for a in orderbook.asks) if orderbook.asks else 0.0

            if max_bid > 0 and (max_bid / max(total_bid, 1e-6)) >= 0.32:
                wall_detected = True
                wall_side = "BID"
                observations.append(
                    ObservationItem(
                        metric="RESTING_BID_WALL",
                        value=round(max_bid, 2),
                        interpretation=f"Large resting bid wall observed holding {(max_bid / total_bid):.1%} of cumulative bid depth.",
                        source="ORDERBOOK",
                    )
                )
            elif max_ask > 0 and (max_ask / max(total_ask, 1e-6)) >= 0.32:
                wall_detected = True
                wall_side = "ASK"
                observations.append(
                    ObservationItem(
                        metric="RESTING_ASK_WALL",
                        value=round(max_ask, 2),
                        interpretation=f"Large resting ask wall observed holding {(max_ask / total_ask):.1%} of cumulative ask depth.",
                        source="ORDERBOOK",
                    )
                )
        elif abs(orderbook_imbalance) >= 0.35:
            wall_detected = True
            wall_side = "BID" if orderbook_imbalance > 0 else "ASK"

        # 2. Volume Concentration Anomaly
        concentration_score = min(1.0, max(0.0, (volume_volatility / 0.50) * 0.5 + (max(0.0, volume_change) / 0.50) * 0.5))

        if volume_change >= 0.20:
            observations.append(
                ObservationItem(
                    metric="VOLUME_SURGE",
                    value=round(volume_change, 4),
                    interpretation=f"Trading volume increased by {volume_change:+.1%} relative to the trailing mean.",
                    source="VOLUME",
                )
            )

        # 3. Absorption Ratio (Volume per unit of price change)
        abs_returns_pct = max(0.001, abs(returns) * 100.0)
        norm_vol_factor = max(0.1, 1.0 + volume_change)
        absorption_ratio = norm_vol_factor / abs_returns_pct

        if absorption_ratio >= 1.5 and volume_change > 0.10:
            observations.append(
                ObservationItem(
                    metric="ABSORPTION_SIGNATURE",
                    value=round(absorption_ratio, 2),
                    interpretation=(
                        f"High volume absorption ratio ({absorption_ratio:.2f}): high turnover with subdued price displacement."
                    ),
                    source="VOLUME",
                )
            )

        indicator = WhaleActivityIndicator(
            wall_detected=wall_detected,
            wall_side=wall_side,
            concentration_score=round(concentration_score, 4),
            absorption_ratio=round(absorption_ratio, 4),
            large_order_clustering=wall_detected and concentration_score > 0.40,
        )
        return indicator, observations
