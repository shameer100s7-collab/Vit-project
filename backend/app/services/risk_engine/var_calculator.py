"""Value at Risk (VaR) and Conditional Value at Risk (CVaR) mathematical models."""

from typing import Tuple
import numpy as np
import pandas as pd
from scipy import stats

from app.schemas.risk import VaRMetrics


class VaRCalculator:
    """Calculates Parametric (Variance-Covariance) and Historical Simulation VaR/CVaR."""

    @staticmethod
    def calculate_parametric_var_cvar(
        returns: pd.Series,
        confidence: float = 0.95,
        horizon_days: int = 1,
    ) -> Tuple[float, float]:
        """Calculates parametric Gaussian Value at Risk (VaR) and Conditional VaR (CVaR).

        VaR = (z_alpha * sigma - mu) * sqrt(horizon)
        CVaR = (sigma * phi(z_alpha) / (1 - alpha) - mu) * sqrt(horizon)

        Returns:
            Tuple of (var, cvar) expressed as positive loss decimals.
        """
        clean_returns = returns.dropna()
        if len(clean_returns) < 2:
            return 0.0, 0.0

        mu = float(clean_returns.mean())
        sigma = float(clean_returns.std(ddof=1))

        if sigma <= 1e-9:
            loss = max(0.0, -mu * np.sqrt(horizon_days))
            return round(loss, 6), round(loss, 6)

        z = float(stats.norm.ppf(confidence))
        phi_z = float(stats.norm.pdf(z))

        alpha = 1.0 - confidence
        var_loss = (z * sigma - mu) * np.sqrt(horizon_days)
        cvar_loss = (sigma * (phi_z / alpha) - mu) * np.sqrt(horizon_days)

        var = max(0.0, var_loss)
        cvar = max(var, cvar_loss)
        return round(float(var), 6), round(float(cvar), 6)

    @staticmethod
    def calculate_historical_var_cvar(
        returns: pd.Series,
        confidence: float = 0.95,
        horizon_days: int = 1,
    ) -> Tuple[float, float]:
        """Calculates non-parametric historical simulation VaR and CVaR.

        VaR is the negative of the (1 - confidence) empirical quantile.
        CVaR is the negative of the expected return strictly below the VaR cutoff.

        Returns:
            Tuple of (var, cvar) expressed as positive loss decimals.
        """
        clean_returns = returns.dropna()
        if len(clean_returns) < 2:
            return 0.0, 0.0

        percentile_level = (1.0 - confidence) * 100.0
        cutoff = float(np.percentile(clean_returns.values, percentile_level))

        scale = np.sqrt(horizon_days)
        var = max(0.0, -cutoff * scale)

        tail_losses = clean_returns[clean_returns <= cutoff]
        if len(tail_losses) > 0:
            cvar = max(var, -float(tail_losses.mean()) * scale)
        else:
            cvar = var

        return round(float(var), 6), round(float(cvar), 6)

    @classmethod
    def evaluate_var_metrics(
        cls,
        returns: pd.Series,
        horizon_days: int = 1,
    ) -> VaRMetrics:
        """Evaluates both 95% and 99% parametric and historical VaR & CVaR metrics."""
        clean = returns.dropna()
        if len(clean) < 2:
            return VaRMetrics(
                var_95_daily=0.0,
                var_99_daily=0.0,
                cvar_95_daily=0.0,
                cvar_99_daily=0.0,
                parametric_var_95=0.0,
                historical_var_95=0.0,
                parametric_cvar_95=0.0,
                historical_cvar_95=0.0,
                method="INSUFFICIENT_DATA",
            )

        p_var_95, p_cvar_95 = cls.calculate_parametric_var_cvar(clean, 0.95, horizon_days)
        p_var_99, p_cvar_99 = cls.calculate_parametric_var_cvar(clean, 0.99, horizon_days)

        h_var_95, h_cvar_95 = cls.calculate_historical_var_cvar(clean, 0.95, horizon_days)
        h_var_99, h_cvar_99 = cls.calculate_historical_var_cvar(clean, 0.99, horizon_days)

        # Primary hybrid: conservative blend (max of parametric and historical)
        var_95 = max(p_var_95, h_var_95)
        var_99 = max(p_var_99, h_var_99)
        cvar_95 = max(p_cvar_95, h_cvar_95)
        cvar_99 = max(p_cvar_99, h_cvar_99)

        return VaRMetrics(
            var_95_daily=round(var_95, 6),
            var_99_daily=round(var_99, 6),
            cvar_95_daily=round(cvar_95, 6),
            cvar_99_daily=round(cvar_99, 6),
            parametric_var_95=p_var_95,
            historical_var_95=h_var_95,
            parametric_cvar_95=p_cvar_95,
            historical_cvar_95=h_cvar_95,
            method="CONSERVATIVE_HYBRID",
        )
