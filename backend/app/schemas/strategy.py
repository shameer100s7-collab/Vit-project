"""Pydantic schemas for quantitative strategy registry, backtesting, and verification."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class StrategyCreate(BaseModel):
    """Payload to submit and canonicalize a trading strategy."""
    name: str = Field(..., min_length=2, max_length=120, description="Strategy name")
    description: Optional[str] = Field(default="", description="Strategy operational premise")
    asset: str = Field(default="BTC/USDT", description="Target trading asset")
    timeframe: str = Field(default="1h", description="Trading candle timeframe")
    entry_condition: str = Field(default="EMA9 > EMA21", description="Deterministic entry condition")
    exit_condition: str = Field(default="EMA9 < EMA21", description="Deterministic exit condition")
    stop_loss_pct: float = Field(default=2.0, ge=0.1, le=50.0, description="Stop loss threshold in %")
    take_profit_pct: float = Field(default=4.0, ge=0.1, le=100.0, description="Take profit threshold in %")
    position_sizing_pct: float = Field(default=100.0, ge=1.0, le=100.0, description="Capital allocation %")
    fast_period: int = Field(default=9, ge=2, le=200, description="Fast indicator period (EMA/SMA)")
    slow_period: int = Field(default=21, ge=3, le=500, description="Slow indicator period (EMA/SMA)")
    rsi_period: int = Field(default=14, ge=2, le=100, description="RSI momentum period")
    risk_parameters: Dict[str, Any] = Field(default_factory=dict, description="Additional risk limits")


class StrategyResponse(BaseModel):
    """Canonical strategy record returned to caller."""
    id: str
    name: str
    description: Optional[str] = None
    asset: str
    timeframe: str
    canonical_rules: Dict[str, Any]
    strategy_hash: str
    ipfs_cid: Optional[str] = None
    is_onchain: bool = False
    tx_hash: Optional[str] = None
    contract_address: Optional[str] = None
    block_number: Optional[int] = None
    network: Optional[str] = None
    created_at: datetime
    verification_badge: str = "INSUFFICIENT_DATA"
    verification_score: Optional[float] = None
    total_return_pct: Optional[float] = None
    win_rate: Optional[float] = None


class BacktestRunRequest(BaseModel):
    """Parameters to trigger backtest against real exchange data."""
    asset: Optional[str] = None
    timeframe: Optional[str] = None
    limit: int = Field(default=150, ge=30, le=1000, description="Historical candle count from Binance")
    initial_capital: float = Field(default=10000.0, ge=100.0, description="Simulated USD starting capital")
    fee_pct: float = Field(default=0.00075, ge=0.0, le=0.05, description="Exchange fee percentage")
    slippage_pct: float = Field(default=0.0005, ge=0.0, le=0.05, description="Execution slippage percentage")


class BacktestResultResponse(BaseModel):
    """Granular results of deterministic backtesting."""
    backtest_run_id: str
    asset: str
    timeframe: str
    start_date: str
    end_date: str
    candle_count: int
    parameters: Dict[str, Any]
    performance: Dict[str, Any]
    equity_curve: List[Dict[str, Any]]
    trades_log: List[Dict[str, Any]]
    data_provenance: Dict[str, Any]


class PaperTradeRecord(BaseModel):
    """Individual trade execution generated in paper trading."""
    trade_id: str
    strategy_id: str
    asset: str
    direction: str
    entry_price: float
    exit_price: Optional[float] = None
    quantity: float
    timestamp: str
    pnl: float = 0.0
    exit_reason: Optional[str] = None


class PaperTradingStatusResponse(BaseModel):
    """Current live paper trading telemetry and portfolio status."""
    strategy_id: str
    asset: str
    is_active: bool
    status: str
    started_at: Optional[str] = None
    last_signal: str
    last_signal_time: Optional[str] = None
    current_price: float
    open_position: Optional[Dict[str, Any]] = None
    realized_pnl: float
    unrealized_pnl: float
    total_trades: int
    win_rate: float
    trades: List[Dict[str, Any]] = Field(default_factory=list)


class OnChainProofResponse(BaseModel):
    """Verifiable on-chain strategy registry proof."""
    strategy_id: str
    strategy_hash: str
    ipfs_cid: Optional[str] = None
    blockchain_network: str
    contract_address: str
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    registration_timestamp: Optional[str] = None
    status: str
    explorer_url: Optional[str] = None
    is_verified: bool = False


class VerificationResponse(BaseModel):
    """Complete multi-dimensional verification dashboard evaluation."""
    strategy_id: str
    badge: str
    score: Optional[float] = None
    score_breakdown: Dict[str, Any]
    performance_analysis: str
    risk_analysis: str
    overfitting_analysis: str
    anomalies: List[Dict[str, Any]]
    failure_conditions: List[Dict[str, Any]]
    data_provenance: Dict[str, Any]
