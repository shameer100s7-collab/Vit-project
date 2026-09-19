"""Order book liquidity pressure, depth asymmetry, and spread dynamics."""

from typing import List, Optional, Tuple

from app.schemas.behavior import LiquidityPressure, ObservationItem
from app.schemas.market import CanonicalOrderBook


class LiquidityModel:
    """Analyzes observable depth of market asymmetry and order book microstructure resilience."""

    @staticmethod
    def evaluate_liquidity(
        orderbook: Optional[CanonicalOrderBook],
        close_price: float = 1.0,
    ) -> Tuple[LiquidityPressure, List[ObservationItem]]:
        """Computes liquidity pressure metrics and emits factual observations."""
        observations: List[ObservationItem] = []

        if not orderbook or not orderbook.bids or not orderbook.asks:
            # Degenerate or unavailable order book fallback
            pressure = LiquidityPressure(
                bid_pressure=1.0,
                ask_pressure=1.0,
                net_imbalance=0.0,
                spread_bps=5.0,
                depth_resilience="MODERATE",
            )
            observations.append(
                ObservationItem(
                    metric="ORDERBOOK_AVAILABILITY",
                    value=0.0,
                    interpretation="Real-time order book depth unavailable; fallback to neutral metrics.",
                    source="ORDERBOOK",
                )
            )
            return pressure, observations

        bid_volume = sum(b.quantity for b in orderbook.bids)
        ask_volume = sum(a.quantity for a in orderbook.asks)
        total_vol = bid_volume + ask_volume

        net_imbalance = (bid_volume - ask_volume) / max(total_vol, 1e-6)
        net_imbalance = max(-1.0, min(1.0, net_imbalance))

        if orderbook.bids and orderbook.asks:
            mid_price = (orderbook.bids[0].price + orderbook.asks[0].price) / 2.0
        else:
            mid_price = max(close_price, 1e-6)

        spread_bps = (orderbook.spread / max(mid_price, 1e-6)) * 10000.0

        # Depth resilience classification
        depth_resilience: str
        if spread_bps <= 4.0 and abs(net_imbalance) <= 0.15:
            depth_resilience = "HIGH"
        elif abs(net_imbalance) >= 0.30:
            depth_resilience = "ASYMMETRIC"
        elif spread_bps >= 15.0:
            depth_resilience = "FRAGILE"
        else:
            depth_resilience = "MODERATE"

        # Factual observations
        observations.append(
            ObservationItem(
                metric="BID_ASK_SPREAD_BPS",
                value=round(spread_bps, 2),
                interpretation=f"Top-of-book bid-ask spread is {spread_bps:.1f} basis points.",
                source="ORDERBOOK",
            )
        )
        observations.append(
            ObservationItem(
                metric="DEPTH_IMBALANCE",
                value=round(net_imbalance, 4),
                interpretation=(
                    f"Cumulative depth is skewed {net_imbalance:+.1%} toward "
                    f"{'buyer bids' if net_imbalance > 0 else 'seller asks'}."
                ),
                source="ORDERBOOK",
            )
        )
        observations.append(
            ObservationItem(
                metric="TOTAL_OBSERVABLE_LIQUIDITY",
                value=round(total_vol, 2),
                interpretation=f"Total observable resting limit order volume across top levels is {total_vol:.2f} units.",
                source="ORDERBOOK",
            )
        )

        pressure = LiquidityPressure(
            bid_pressure=round(bid_volume, 4),
            ask_pressure=round(ask_volume, 4),
            net_imbalance=round(net_imbalance, 4),
            spread_bps=round(spread_bps, 2),
            depth_resilience=depth_resilience,
        )
        return pressure, observations
