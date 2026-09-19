"""Quantitative risk-budgeted position sizing engine."""

import numpy as np
from app.schemas.risk import PositionSizingRecommendation


class PositionSizingEngine:
    """Calculates volatility-targeted position sizing limits and leverage bounds."""

    @staticmethod
    def calculate_position_sizing(
        volatility_annualized: float,
        var_95_daily: float,
        max_drawdown: float,
        target_volatility: float = 0.20,
        risk_budget_pct: float = 0.02,
    ) -> PositionSizingRecommendation:
        """Determines maximum safe allocation percentage and leverage multiplier.

        Principles:
        1. Volatility Parity Scaling: positions scaled inversely to asset volatility.
        2. VaR Constraint: 1-day 95% VaR loss cannot breach the risk budget.
        3. Drawdown Penalty: deep historical drawdowns enforce conservative sizing caps.
        """
        effective_vol = max(0.05, volatility_annualized)
        vol_scalar = target_volatility / effective_vol

        # Target sizing from volatility parity (assuming baseline 25% allocation for target vol)
        target_allocation = 0.25 * vol_scalar

        # VaR-based cap: Allocation * VaR_daily <= risk_budget_pct
        effective_var = max(0.01, var_95_daily)
        var_constrained_cap = risk_budget_pct / effective_var

        # Deep drawdown haircut
        dd_penalty = 1.0
        if max_drawdown < -0.40:
            dd_penalty = 0.75
        elif max_drawdown < -0.60:
            dd_penalty = 0.50

        # Combine bounds: strictly between 2% (0.02) and 40% (0.40)
        recommended_cap = min(target_allocation, var_constrained_cap) * dd_penalty
        bounded_cap = float(np.clip(recommended_cap, 0.02, 0.40))

        # Safe leverage determination
        if volatility_annualized >= 0.65 or var_95_daily >= 0.06 or max_drawdown <= -0.45:
            recommended_leverage = 1.0
        elif volatility_annualized <= 0.25 and var_95_daily <= 0.025:
            recommended_leverage = 1.5
        else:
            recommended_leverage = 1.0

        rationale = (
            f"Volatility scalar ({round(vol_scalar, 2)}x) against {int(target_volatility * 100)}% target vol. "
            f"Daily 95% VaR of {round(var_95_daily * 100, 2)}% yields max safe allocation of {round(bounded_cap * 100, 1)}% "
            f"within a {int(risk_budget_pct * 100)}% risk budget."
        )

        return PositionSizingRecommendation(
            max_position_pct=round(bounded_cap, 4),
            recommended_leverage=recommended_leverage,
            risk_budget_pct=risk_budget_pct,
            volatility_scalar=round(float(vol_scalar), 4),
            rationale=rationale,
        )
