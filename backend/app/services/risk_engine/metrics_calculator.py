"""Risk-adjusted performance metrics, volatility, and market sensitivity calculators."""

from typing import Tuple
import numpy as np
import pandas as pd

from app.schemas.risk import RiskAdjustedMetrics, SensitivityMetrics


class RiskMetricsCalculator:
    """Calculates Sharpe, Sortino, Calmar, realized volatility, and market Beta."""

    @staticmethod
    def calculate_annualized_volatility(
        returns: pd.Series,
        periods_per_year: int = 365,
    ) -> float:
        """Calculates annualized standard deviation of returns.

        Formula: std(returns) * sqrt(periods_per_year)
        """
        clean = returns.dropna()
        if len(clean) < 2:
            return 0.0
        daily_std = float(clean.std(ddof=1))
        ann_vol = daily_std * np.sqrt(periods_per_year)
        return round(float(ann_vol), 4)

    @staticmethod
    def calculate_downside_deviation(
        returns: pd.Series,
        target_return: float = 0.0,
        periods_per_year: int = 365,
    ) -> float:
        """Calculates annualized downside semi-deviation below a minimum acceptable return."""
        clean = returns.dropna()
        if len(clean) < 2:
            return 0.0

        period_target = target_return / periods_per_year
        downside_diff = np.minimum(0.0, clean.values - period_target)
        downside_variance = np.mean(downside_diff ** 2)
        downside_dev = np.sqrt(downside_variance) * np.sqrt(periods_per_year)
        return round(float(downside_dev), 4)

    @classmethod
    def calculate_risk_adjusted_metrics(
        cls,
        returns: pd.Series,
        max_drawdown: float,
        risk_free_rate: float = 0.04,
        periods_per_year: int = 365,
    ) -> RiskAdjustedMetrics:
        """Calculates Sharpe, Sortino, Calmar, and return distributions."""
        clean = returns.dropna()
        if len(clean) < 2:
            return RiskAdjustedMetrics(
                sharpe_ratio=0.0,
                sortino_ratio=0.0,
                calmar_ratio=0.0,
                annualized_return=0.0,
                annualized_volatility=0.0,
                downside_deviation=0.0,
                risk_free_rate=risk_free_rate,
            )

        mean_return = float(clean.mean())
        ann_return = mean_return * periods_per_year
        ann_vol = cls.calculate_annualized_volatility(clean, periods_per_year)
        downside_dev = cls.calculate_downside_deviation(clean, risk_free_rate, periods_per_year)

        # Sharpe ratio: excess return / volatility
        excess_return = ann_return - risk_free_rate
        if ann_vol > 1e-6:
            sharpe = excess_return / ann_vol
        else:
            sharpe = 0.0

        # Sortino ratio: excess return / downside deviation
        if downside_dev > 1e-6:
            sortino = excess_return / downside_dev
        else:
            sortino = sharpe if sharpe > 0 else 0.0

        # Calmar ratio: annualized return / |max_drawdown|
        abs_mdd = abs(max_drawdown)
        if abs_mdd > 1e-4:
            calmar = ann_return / abs_mdd
        else:
            calmar = ann_return / 0.0001 if ann_return > 0 else 0.0

        return RiskAdjustedMetrics(
            sharpe_ratio=round(float(sharpe), 4),
            sortino_ratio=round(float(sortino), 4),
            calmar_ratio=round(float(calmar), 4),
            annualized_return=round(float(ann_return), 4),
            annualized_volatility=round(float(ann_vol), 4),
            downside_deviation=round(float(downside_dev), 4),
            risk_free_rate=risk_free_rate,
        )

    @staticmethod
    def calculate_beta_and_correlation(
        asset_returns: pd.Series,
        benchmark_returns: pd.Series,
        benchmark_symbol: str = "BTC/USDT",
    ) -> SensitivityMetrics:
        """Calculates systematic market Beta and correlation against benchmark."""
        # Align series by index or truncated length
        if len(asset_returns) == 0 or len(benchmark_returns) == 0:
            return SensitivityMetrics(
                beta=1.0,
                correlation_with_benchmark=1.0,
                benchmark_symbol=benchmark_symbol,
            )

        # Take common trailing window
        min_len = min(len(asset_returns), len(benchmark_returns))
        r_a = asset_returns.iloc[-min_len:].values
        r_b = benchmark_returns.iloc[-min_len:].values

        var_b = float(np.var(r_b, ddof=1)) if min_len > 1 else 0.0
        var_a = float(np.var(r_a, ddof=1)) if min_len > 1 else 0.0

        if var_b <= 1e-9:
            # Benchmark has zero variance
            return SensitivityMetrics(
                beta=1.0 if var_a > 1e-9 else 0.0,
                correlation_with_benchmark=0.0,
                benchmark_symbol=benchmark_symbol,
            )

        cov = float(np.cov(r_a, r_b)[0, 1]) if min_len > 1 else 0.0
        beta = cov / var_b

        std_a = np.sqrt(var_a)
        std_b = np.sqrt(var_b)
        if std_a * std_b > 1e-9:
            corr = cov / (std_a * std_b)
        else:
            corr = 0.0

        return SensitivityMetrics(
            beta=round(float(beta), 4),
            correlation_with_benchmark=round(float(np.clip(corr, -1.0, 1.0)), 4),
            benchmark_symbol=benchmark_symbol,
        )
