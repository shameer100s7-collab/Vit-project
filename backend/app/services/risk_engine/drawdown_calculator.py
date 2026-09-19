"""Peak-to-trough drawdown dynamics and capital preservation calculator."""

import pandas as pd
from app.schemas.risk import DrawdownMetrics


class DrawdownCalculator:
    """Calculates Maximum Drawdown (MDD), current drawdown, and duration metrics."""

    @staticmethod
    def calculate_drawdown_metrics(prices: pd.Series) -> DrawdownMetrics:
        """Calculates comprehensive drawdown dynamics from a closing price series.

        Returns:
            DrawdownMetrics schema instance.
        """
        clean_prices = prices.dropna()
        if len(clean_prices) < 2:
            single_p = float(clean_prices.iloc[0]) if len(clean_prices) == 1 else 0.0
            return DrawdownMetrics(
                max_drawdown=0.0,
                current_drawdown=0.0,
                drawdown_duration_periods=0,
                peak_price=single_p,
                trough_price=single_p,
            )

        cummax = clean_prices.cummax()
        drawdown_series = (clean_prices - cummax) / cummax.replace(0.0, 1e-9)

        # Max drawdown is negative float
        min_dd = float(drawdown_series.min())
        max_drawdown = min(0.0, min_dd)

        # Current drawdown from all-time peak
        current_dd = float(drawdown_series.iloc[-1])
        current_drawdown = min(0.0, current_dd)

        # Deepest trough price
        trough_idx = drawdown_series.idxmin()
        trough_price = float(clean_prices.loc[trough_idx])
        peak_price = float(clean_prices.max())

        # Duration in periods: steps since the most recent peak
        is_at_peak = clean_prices >= cummax
        peak_indices = clean_prices[is_at_peak].index
        if len(peak_indices) > 0:
            last_peak_idx = peak_indices[-1]
            last_peak_pos = clean_prices.index.get_loc(last_peak_idx)
            duration_periods = int(len(clean_prices) - 1 - last_peak_pos)
        else:
            duration_periods = 0

        return DrawdownMetrics(
            max_drawdown=round(max_drawdown, 4),
            current_drawdown=round(current_drawdown, 4),
            drawdown_duration_periods=duration_periods,
            peak_price=round(peak_price, 4),
            trough_price=round(trough_price, 4),
        )
