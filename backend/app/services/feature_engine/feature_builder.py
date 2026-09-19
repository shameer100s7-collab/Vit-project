"""Feature builder orchestrating indicator extraction and dataset preparation without look-ahead bias."""

from datetime import datetime
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from app.core.exceptions import ValidationException
from app.schemas.features import FeatureSnapshot
from app.schemas.market import CanonicalCandle, CanonicalOrderBook
from app.services.feature_engine import indicators

FEATURE_VERSION = "v1.0"


class FeatureBuilder:
    """Constructs point-in-time and time-series feature matrices from canonical candles."""

    def __init__(self, feature_version: str = FEATURE_VERSION) -> None:
        self.feature_version = feature_version

    def _candles_to_dataframe(self, candles: List[CanonicalCandle]) -> pd.DataFrame:
        """Converts candles to a strictly chronological DataFrame with validated timestamps."""
        if not candles:
            raise ValidationException("Cannot construct features from an empty candle list.")

        records = [
            {
                "timestamp": c.timestamp,
                "open": float(c.open),
                "high": float(c.high),
                "low": float(c.low),
                "close": float(c.close),
                "volume": float(c.volume),
            }
            for c in candles
        ]
        df = pd.DataFrame(records)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        # Ensure strict chronological order to avoid future-leakage
        df = df.sort_values("timestamp").reset_index(drop=True)
        return df

    def build_feature_matrix(self, candles: List[CanonicalCandle]) -> pd.DataFrame:
        """Computes complete time series feature matrix for model training or historical research."""
        df = self._candles_to_dataframe(candles)

        close = df["close"]
        high = df["high"]
        low = df["low"]
        volume = df["volume"]

        # 1. Return Features
        df["returns"] = indicators.calculate_returns(close)
        df["log_returns"] = indicators.calculate_log_returns(close)

        # 2. Volatility Features
        df["volatility_20"] = indicators.calculate_rolling_volatility(df["returns"], window=20)
        df["atr_14"] = indicators.calculate_atr(high, low, close, period=14)

        # 3. Moving Averages & Trend
        df["sma_20"] = indicators.calculate_sma(close, window=20)
        df["sma_50"] = indicators.calculate_sma(close, window=50)
        df["ema_12"] = indicators.calculate_ema(close, span=12)
        df["ema_26"] = indicators.calculate_ema(close, span=26)
        df["trend_strength"] = indicators.calculate_trend_strength(close, short_window=20, long_window=50)

        # 4. Momentum & Oscillators
        df["rsi_14"] = indicators.calculate_rsi(close, period=14)
        df["macd"], df["macd_signal"], df["macd_hist"] = indicators.calculate_macd(close)
        df["momentum_10"] = indicators.calculate_momentum(close, period=10)

        # 5. Volatility Envelopes
        df["bb_middle"], df["bb_upper"], df["bb_lower"], df["bb_bandwidth"] = indicators.calculate_bollinger_bands(close)

        # 6. Volume Dynamics
        df["volume_change"] = indicators.calculate_volume_change(volume)
        df["volume_volatility_20"] = indicators.calculate_volume_volatility(volume, window=20)

        # 7. Drawdown
        df["drawdown"], df["max_drawdown"] = indicators.calculate_drawdown(close)

        # Replace any residual infinities
        df = df.replace([np.inf, -np.inf], 0.0)
        return df

    def build_inference_features(
        self,
        symbol: str,
        candles: List[CanonicalCandle],
        orderbook: Optional[CanonicalOrderBook] = None,
    ) -> FeatureSnapshot:
        """Computes single point-in-time feature snapshot for live model inference and signals."""
        if len(candles) < 5:
            raise ValidationException(f"Insufficient candle history for {symbol}: minimum 5 candles required.")

        df = self.build_feature_matrix(candles)
        latest_row = df.iloc[-1]

        features: Dict[str, float] = {
            "close": float(latest_row["close"]),
            "returns": float(latest_row["returns"]),
            "log_returns": float(latest_row["log_returns"]),
            "volatility_20": float(latest_row["volatility_20"]),
            "atr_14": float(latest_row["atr_14"]),
            "sma_20": float(latest_row["sma_20"]),
            "sma_50": float(latest_row["sma_50"]),
            "ema_12": float(latest_row["ema_12"]),
            "ema_26": float(latest_row["ema_26"]),
            "trend_strength": float(latest_row["trend_strength"]),
            "rsi_14": float(latest_row["rsi_14"]),
            "macd": float(latest_row["macd"]),
            "macd_signal": float(latest_row["macd_signal"]),
            "macd_hist": float(latest_row["macd_hist"]),
            "momentum_10": float(latest_row["momentum_10"]),
            "bb_bandwidth": float(latest_row["bb_bandwidth"]),
            "volume_change": float(latest_row["volume_change"]),
            "volume_volatility_20": float(latest_row["volume_volatility_20"]),
            "drawdown": float(latest_row["drawdown"]),
        }

        # Orderbook microstructure feature if available
        if orderbook and orderbook.bids and orderbook.asks:
            features["orderbook_imbalance"] = indicators.calculate_orderbook_imbalance(
                orderbook.bids,
                orderbook.asks,
            )
            features["orderbook_spread"] = float(orderbook.spread)
        else:
            features["orderbook_imbalance"] = 0.0
            features["orderbook_spread"] = 0.0

        return FeatureSnapshot(
            symbol=symbol.upper(),
            timestamp=latest_row["timestamp"].to_pydatetime(),
            feature_version=self.feature_version,
            features=features,
            warmup_periods_used=len(candles),
        )
