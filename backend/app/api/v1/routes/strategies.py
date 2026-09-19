"""API endpoints for quantitative strategy marketplace, backtesting, paper trading, and on-chain verification."""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, status

from app.schemas.strategy import (
    BacktestResultResponse,
    BacktestRunRequest,
    OnChainProofResponse,
    PaperTradingStatusResponse,
    StrategyCreate,
    StrategyResponse,
    VerificationResponse,
)
from app.services.strategy_service import StrategyService, get_strategy_service

router = APIRouter()


@router.get(
    "",
    response_model=List[StrategyResponse],
    summary="List Marketplace Strategies",
    description="Returns all registered strategies with verification badges, returns, and on-chain proof statuses.",
)
async def list_strategies(
    service: StrategyService = Depends(get_strategy_service),
) -> List[StrategyResponse]:
    return await service.list_strategies()


@router.post(
    "",
    response_model=StrategyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit and Canonicalize Strategy",
    description="Validates strategy parameters, canonicalizes rules, and computes deterministic cryptographic hash.",
)
async def create_strategy(
    payload: StrategyCreate,
    service: StrategyService = Depends(get_strategy_service),
) -> StrategyResponse:
    return await service.create_strategy(payload)


@router.get(
    "/{strategy_id}",
    response_model=StrategyResponse,
    summary="Retrieve Strategy Details",
    description="Returns detailed machine-readable canonical rules and registry metadata for a strategy.",
)
async def get_strategy(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
) -> StrategyResponse:
    return await service.get_strategy(strategy_id)


@router.post(
    "/{strategy_id}/backtest",
    response_model=BacktestResultResponse,
    summary="Execute Real Historical Backtest",
    description="Evaluates strategy rules against actual historical Binance OHLCV candles without simulated placeholders.",
)
async def run_backtest(
    strategy_id: str,
    req: BacktestRunRequest,
    service: StrategyService = Depends(get_strategy_service),
) -> BacktestResultResponse:
    return await service.run_backtest(strategy_id, req)


@router.get(
    "/{strategy_id}/backtest",
    response_model=BacktestResultResponse,
    summary="Get Latest Backtest Outcome",
    description="Returns the most recent backtest metrics, equity curve, and trade log.",
)
async def get_latest_backtest(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
) -> Any:
    res = await service.get_latest_backtest(strategy_id)
    if not res:
        # If not run yet, run an initial real backtest automatically
        return await service.run_backtest(strategy_id, BacktestRunRequest())
    return res


@router.post(
    "/{strategy_id}/paper-trading/start",
    response_model=PaperTradingStatusResponse,
    summary="Start Live Paper Trading Session",
    description="Initializes live paper execution receiving actual Binance spot prices.",
)
async def start_paper_trading(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
) -> PaperTradingStatusResponse:
    strat = await service.get_strategy(strategy_id)
    res = await service.paper_trading_service.start_paper_trading(
        strategy_id=strategy_id,
        asset=strat.asset,
    )
    return PaperTradingStatusResponse(**res)


@router.post(
    "/{strategy_id}/paper-trading/stop",
    response_model=PaperTradingStatusResponse,
    summary="Stop Live Paper Trading Session",
    description="Halts live paper trading and liquidates simulated open position at current market price.",
)
async def stop_paper_trading(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
) -> PaperTradingStatusResponse:
    res = await service.paper_trading_service.stop_paper_trading(strategy_id)
    return PaperTradingStatusResponse(**res)


@router.get(
    "/{strategy_id}/paper-trading",
    response_model=PaperTradingStatusResponse,
    summary="Get Live Paper Trading Status",
    description="Returns current paper balance, open position, realized/unrealized P&L, and trade executions.",
)
async def get_paper_trading_status(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
) -> PaperTradingStatusResponse:
    res = await service.paper_trading_service.get_paper_status(strategy_id)
    return PaperTradingStatusResponse(**res)


@router.post(
    "/{strategy_id}/paper-trading/tick",
    response_model=PaperTradingStatusResponse,
    summary="Evaluate Live Paper Trading Tick",
    description="Polls live exchange price and executes any triggered strategy signals.",
)
async def evaluate_paper_trading_tick(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
) -> PaperTradingStatusResponse:
    strat = await service.get_strategy(strategy_id)
    res = await service.paper_trading_service.evaluate_tick(
        strategy_id=strategy_id,
        rules=strat.canonical_rules,
    )
    return PaperTradingStatusResponse(**res)


@router.post(
    "/{strategy_id}/register-onchain",
    response_model=OnChainProofResponse,
    summary="Register Strategy On-Chain",
    description="Commits the cryptographic strategy hash to the EVM smart contract and returns transaction proof.",
)
async def register_onchain(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
) -> OnChainProofResponse:
    return await service.register_onchain(strategy_id)


@router.get(
    "/{strategy_id}/onchain",
    response_model=OnChainProofResponse,
    summary="Get On-Chain Proof",
    description="Returns verified on-chain registration proof or NOT_REGISTERED status.",
)
async def get_onchain_proof(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
) -> OnChainProofResponse:
    return await service.get_onchain_proof(strategy_id)


@router.get(
    "/{strategy_id}/verification",
    response_model=VerificationResponse,
    summary="Get Strategy Verification Dashboard",
    description="Returns complete AI verification assessment, anomaly detection, failure conditions, and transparent score.",
)
async def get_verification(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
) -> VerificationResponse:
    return await service.get_verification(strategy_id)


@router.get(
    "/{strategy_id}/provenance",
    response_model=Dict[str, Any],
    summary="Get Data Provenance",
    description="Returns data source, time period, backtest run ID, and fee/slippage parameters.",
)
async def get_provenance(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
) -> Dict[str, Any]:
    bt = await service.get_latest_backtest(strategy_id)
    if bt:
        return bt.data_provenance
    return {
        "status": "No backtest performed",
        "data_source": "Binance Spot Public REST",
    }
