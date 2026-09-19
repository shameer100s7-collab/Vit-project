"""Mathematical indicator algorithms and quantitative feature transformers.

All implementations strictly consume trailing time series data to avoid look-ahead bias.
"""

from typing import List, Tuple
import numpy as np
import pandas as pd

from app.schemas.market import OrderBookLevel


def calculate_returns(series: pd.Series, periods: int = 1) -> pd.Series:
    """Calculates arithmetic percentage returns: (P_t - P_{t-k}) / P_{t-k}."""
    return series.pct_change(periods=periods).fillna(0.0)


def calculate_log_returns(series: pd.Series, periods: int = 1) -> pd.Series:
    """Calculates continuous logarithmic returns: ln(P_t / P_{t-k})."""
    shifted = series.shift(periods)
    # Avoid division by zero or log of non-positive numbers
    ratio = series / shifted
    ratio = ratio.replace([np.inf, -np.inf], np.nan).fillna(1.0)
    ratio = np.maximum(ratio, 1e-9)
    return np.log(ratio).fillna(0.0)


def calculate_rolling_volatility(
    returns: pd.Series,
    window: int = 20,
    annualized: bool = True,
    periods_per_year: int = 365,
) -> pd.Series:
    """Calculates rolling standard deviation of returns, optionally annualized.

    Formula: std(R_{t-w:t}) * sqrt(periods_per_year)
    """
    vol = returns.rolling(window=window, min_periods=max(2, window // 2)).std()
    if annualized:
        vol = vol * np.sqrt(periods_per_year)
    return vol.fillna(0.0)


def calculate_sma(series: pd.Series, window: int = 20) -> pd.Series:
    """Calculates trailing Simple Moving Average (SMA)."""
    return series.rolling(window=window, min_periods=1).mean()


def calculate_ema(series: pd.Series, span: int = 20) -> pd.Series:
    """Calculates trailing Exponential Moving Average (EMA)."""
    return series.ewm(span=span, adjust=False).mean()


def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Calculates Relative Strength Index (RSI) bounded in [0, 100].

    RS = AvgGain / AvgLoss
    RSI = 100 - (100 / (1 + RS))
    """
    delta = series.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)

    # Use exponential moving average for Wilder-like smoothing
    avg_gain = gain.ewm(alpha=1.0 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, adjust=False).mean()

    # Avoid zero division
    rs = avg_gain / avg_loss.replace(0.0, 1e-9)
    rsi = 100.0 - (100.0 / (1.0 + rs))

    # Clean initial NaN and edge values
    rsi = rsi.fillna(50.0)
    return rsi.clip(lower=0.0, upper=100.0)


def calculate_macd(
    series: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """Calculates Moving Average Convergence Divergence (MACD).

    Returns:
        (macd_line, signal_line, histogram)
    """
    fast_ema = calculate_ema(series, span=fast)
    slow_ema = calculate_ema(series, span=slow)
    macd_line = fast_ema - slow_ema
    signal_line = calculate_ema(macd_line, span=signal)
    hist = macd_line - signal_line
    return macd_line, signal_line, hist


def calculate_atr(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
) -> pd.Series:
    """Calculates Average True Range (ATR) measuring market volatility.

    TR = max(High - Low, |High - Close_{prev}|, |Low - Close_{prev}|)
    """
    prev_close = close.shift(1).fillna(close)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()

    true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = true_range.ewm(alpha=1.0 / period, adjust=False).mean()
    return atr.fillna(0.0)


def calculate_bollinger_bands(
    series: pd.Series,
    window: int = 20,
    num_std: float = 2.0,
) -> Tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    """Calculates Bollinger Bands and Bandwidth.

    Returns:
        (middle_band, upper_band, lower_band, bandwidth)
    """
    middle = calculate_sma(series, window=window)
    rolling_std = series.rolling(window=window, min_periods=1).std().fillna(0.0)
    upper = middle + (num_std * rolling_std)
    lower = middle - (num_std * rolling_std)
    bandwidth = (upper - lower) / middle.replace(0.0, 1e-9)
    return middle, upper, lower, bandwidth


def calculate_volume_change(volume: pd.Series, periods: int = 1) -> pd.Series:
    """Calculates volume rate of change."""
    return volume.pct_change(periods=periods).replace([np.inf, -np.inf], 0.0).fillna(0.0)


def calculate_volume_volatility(volume: pd.Series, window: int = 20) -> pd.Series:
    """Calculates standard deviation of volume changes."""
    vol_chg = calculate_volume_change(volume)
    return vol_chg.rolling(window=window, min_periods=1).std().fillna(0.0)


def calculate_momentum(series: pd.Series, period: int = 10) -> pd.Series:
    """Calculates price rate of momentum: P_t / P_{t-k} - 1.0."""
    return (series / series.shift(period).replace(0.0, np.nan) - 1.0).fillna(0.0)


def calculate_trend_strength(
    series: pd.Series,
    short_window: int = 20,
    long_window: int = 50,
) -> pd.Series:
    """Calculates moving average divergence trend strength: (SMA_fast - SMA_slow) / SMA_slow."""
    sma_fast = calculate_sma(series, window=short_window)
    sma_slow = calculate_sma(series, window=long_window)
    trend = (sma_fast - sma_slow) / sma_slow.replace(0.0, 1e-9)
    return trend.fillna(0.0)


def calculate_drawdown(series: pd.Series) -> Tuple[pd.Series, pd.Series]:
    """Calculates trailing percentage drawdown from peak and cumulative max drawdown.

    Returns:
        (drawdown_series, max_drawdown_series)
    """
    cumulative_peak = series.cummax()
    drawdown = (series - cumulative_peak) / cumulative_peak.replace(0.0, 1e-9)
    max_drawdown = drawdown.cummin()
    return drawdown.fillna(0.0), max_drawdown.fillna(0.0)


def calculate_orderbook_imbalance(
    bids: List[OrderBookLevel],
    asks: List[OrderBookLevel],
) -> float:
    """Calculates Order Book Imbalance (OBI) bounded in [-1.0, 1.0].

    Formula: (TotalBidVolume - TotalAskVolume) / (TotalBidVolume + TotalAskVolume)
    Positive values reflect bid-heavy demand; negative values indicate ask-heavy supply.
    """
    total_bid = sum(b.quantity for b in bids)
    total_ask = sum(a.quantity for a in asks)
    total_liquidity = total_bid + total_ask
    if total_liquidity <= 0:
        return 0.0
    imbalance = (total_bid - total_ask) / total_liquidity
    return round(float(np.clip(imbalance, -1.0, 1.0)), 4)


def calculate_rolling_correlation(
    series_a: pd.Series,
    series_b: pd.Series,
    window: int = 30,
) -> pd.Series:
    """Calculates rolling Pearson correlation coefficient between two series."""
    return series_a.rolling(window=window, min_periods=max(2, window // 2)).corr(series_b).fillna(0.0)
