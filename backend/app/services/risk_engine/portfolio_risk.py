"""Portfolio risk aggregation, covariance, and concentration calculator."""

from typing import Dict, List, Tuple
import numpy as np
import pandas as pd

from app.schemas.risk import ConcentrationMetrics


class PortfolioRiskCalculator:
    """Calculates portfolio-level variance, covariance structure, and capital concentration."""

    @staticmethod
    def calculate_concentration(raw_weights: Dict[str, float]) -> ConcentrationMetrics:
        """Calculates Herfindahl-Hirschman Index (HHI) and diversification metrics."""
        if not raw_weights:
            return ConcentrationMetrics(
                hhi=1.0,
                normalized_hhi=1.0,
                effective_assets=1.0,
                top_asset_weight=1.0,
                asset_weights={},
            )

        total_weight = sum(raw_weights.values())
        if total_weight <= 1e-9:
            # Equal weight fallback
            n = len(raw_weights)
            weights = {k: 1.0 / n for k in raw_weights}
        else:
            weights = {k: float(v) / total_weight for k, v in raw_weights.items()}

        n = len(weights)
        weight_values = np.array(list(weights.values()))
        hhi = float(np.sum(weight_values ** 2))

        if n <= 1:
            norm_hhi = 0.0
            effective_n = 1.0
        else:
            # Rescale into [0, 1] where 0 is perfectly equal weight, 1 is 100% single asset
            norm_hhi = max(0.0, min(1.0, (hhi - (1.0 / n)) / (1.0 - (1.0 / n))))
            effective_n = 1.0 / max(1e-6, hhi)

        top_weight = float(np.max(weight_values))

        return ConcentrationMetrics(
            hhi=round(hhi, 4),
            normalized_hhi=round(norm_hhi, 4),
            effective_assets=round(effective_n, 2),
            top_asset_weight=round(top_weight, 4),
            asset_weights={k: round(v, 4) for k, v in weights.items()},
        )

    @classmethod
    def compute_portfolio_returns_and_risk(
        cls,
        asset_returns: Dict[str, pd.Series],
        weights: Dict[str, float],
        periods_per_year: int = 365,
    ) -> Tuple[pd.Series, float, Dict[str, float]]:
        """Calculates portfolio synthetic return series, annualized volatility, and marginal risk contributions.

        Returns:
            Tuple of:
            - portfolio_returns: pd.Series
            - annualized_portfolio_vol: float
            - marginal_risk_contributions: Dict[str, float] (summing to 1.0)
        """
        # Filter assets present in returns
        valid_symbols = [s for s in weights if s in asset_returns and len(asset_returns[s].dropna()) >= 2]
        if not valid_symbols:
            empty_series = pd.Series([0.0], dtype=float)
            return empty_series, 0.0, {s: 0.0 for s in weights}

        # Find common index length
        min_len = min(len(asset_returns[s].dropna()) for s in valid_symbols)
        aligned_df = pd.DataFrame({
            s: asset_returns[s].dropna().iloc[-min_len:].values
            for s in valid_symbols
        })

        # Normalize weights for valid symbols
        sub_weights = np.array([weights[s] for s in valid_symbols], dtype=float)
        w_sum = np.sum(sub_weights)
        if w_sum > 0:
            norm_w = sub_weights / w_sum
        else:
            norm_w = np.ones(len(valid_symbols)) / len(valid_symbols)

        # Portfolio returns series: R_p = sum(w_i * R_i)
        p_returns_array = aligned_df.values @ norm_w
        portfolio_returns = pd.Series(p_returns_array)

        # Covariance matrix and portfolio volatility
        cov_matrix = aligned_df.cov().values  # shape (N, N)
        port_var = float(norm_w.T @ cov_matrix @ norm_w)
        daily_vol = np.sqrt(max(0.0, port_var))
        ann_vol = daily_vol * np.sqrt(periods_per_year)

        # Marginal risk contribution (MRC): (w_i * (Sigma * w)_i) / port_var
        mrc_dict: Dict[str, float] = {}
        if port_var > 1e-9:
            sigma_w = cov_matrix @ norm_w
            mrc_vals = (norm_w * sigma_w) / port_var
            for i, sym in enumerate(valid_symbols):
                mrc_dict[sym] = round(float(mrc_vals[i]), 4)
        else:
            for i, sym in enumerate(valid_symbols):
                mrc_dict[sym] = round(float(norm_w[i]), 4)

        # Fill any missing asset
        for s in weights:
            if s not in mrc_dict:
                mrc_dict[s] = 0.0

        return portfolio_returns, round(float(ann_vol), 4), mrc_dict
