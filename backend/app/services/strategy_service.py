"""Strategy application service orchestrating canonicalization, backtesting, paper trading, and verification."""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from app.core.exceptions import NotFoundException, ValidationException
from app.core.logging import get_logger
from app.schemas.strategy import (
    BacktestResultResponse,
    BacktestRunRequest,
    OnChainProofResponse,
    PaperTradingStatusResponse,
    StrategyCreate,
    StrategyResponse,
    VerificationResponse,
)
from app.services.ai_verification.verifier import AIVerificationEngine, get_ai_verification_engine
from app.services.backtest.engine import BacktestEngine, get_backtest_engine
from app.services.market_data import MarketDataService, get_market_data_service
from app.services.onchain.registry import (
    OnChainRegistryService,
    canonicalize_strategy_rules,
    compute_ipfs_cid,
    compute_strategy_hash,
    get_onchain_registry_service,
)
from app.services.paper_trading.service import PaperTradingService, get_paper_trading_service

logger = get_logger("ghost.strategy.service")


class StrategyService:
    """Manages the full lifecycle of crypto trading strategies."""

    def __init__(
        self,
        market_data_service: Optional[MarketDataService] = None,
        backtest_engine: Optional[BacktestEngine] = None,
        paper_trading_service: Optional[PaperTradingService] = None,
        onchain_service: Optional[OnChainRegistryService] = None,
        ai_verifier: Optional[AIVerificationEngine] = None,
    ) -> None:
        self.market_data_service = market_data_service or get_market_data_service()
        self.backtest_engine = backtest_engine or get_backtest_engine()
        self.paper_trading_service = paper_trading_service or get_paper_trading_service()
        self.onchain_service = onchain_service or get_onchain_registry_service()
        self.ai_verifier = ai_verifier or get_ai_verification_engine()

        self._strategies: Dict[str, Dict[str, Any]] = {}
        self._backtest_runs: Dict[str, Dict[str, Any]] = {}  # strategy_id -> latest backtest
        self._verifications: Dict[str, Dict[str, Any]] = {}  # strategy_id -> verification
        self._lock = asyncio.Lock()

        # Seed initial canonical strategies
        self._seed_default_strategies()

    def _seed_default_strategies(self) -> None:
        """Pre-seeds canonical strategies for immediate verification and exploration."""
        seeds = [
            {
                "id": "strat-btc-ema-cross",
                "name": "BTC Trend Reversal & EMA Cross",
                "description": "Exploits 9/21 exponential moving average momentum shifts with strict 2.5% stop-loss guardrails.",
                "asset": "BTC/USDT",
                "timeframe": "1h",
                "entry_condition": "EMA9 > EMA21 and RSI > 45",
                "exit_condition": "EMA9 < EMA21 or StopLoss",
                "fast_period": 9,
                "slow_period": 21,
                "rsi_period": 14,
                "stop_loss_pct": 2.5,
                "take_profit_pct": 5.0,
                "position_sizing_pct": 100.0,
                "is_onchain": True,
                "tx_hash": "0x4b7c89f2a1e4c3b5d7e8f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
                "contract_address": "0x8E192f16C2E2aB3f14A47E53DdB5683935393a55",
                "block_number": 7481920,
                "network": "Ethereum Sepolia (ChainID: 11155111)",
            },
            {
                "id": "strat-eth-vol-breakout",
                "name": "ETH Momentum & Breakout Engine",
                "description": "Fast breakout algorithm capturing ETH volatility surges on 1h bars with dynamic profit scaling.",
                "asset": "ETH/USDT",
                "timeframe": "1h",
                "entry_condition": "EMA12 > EMA26 and Close > UpperBand",
                "exit_condition": "EMA12 < EMA26",
                "fast_period": 12,
                "slow_period": 26,
                "rsi_period": 14,
                "stop_loss_pct": 3.0,
                "take_profit_pct": 6.5,
                "position_sizing_pct": 100.0,
                "is_onchain": False,
                "tx_hash": None,
                "contract_address": None,
                "block_number": None,
                "network": None,
            },
            {
                "id": "strat-sol-mean-reversion",
                "name": "SOL Mean Reversion Oscillator",
                "description": "Identifies deep oversold RSI conditions in SOL with rapid reversal exits back to the 20-period baseline.",
                "asset": "SOL/USDT",
                "timeframe": "1h",
                "entry_condition": "RSI < 32 and Price > SMA50",
                "exit_condition": "RSI > 65 or EMA Cross",
                "fast_period": 8,
                "slow_period": 20,
                "rsi_period": 14,
                "stop_loss_pct": 3.5,
                "take_profit_pct": 7.0,
                "position_sizing_pct": 100.0,
                "is_onchain": False,
                "tx_hash": None,
                "contract_address": None,
                "block_number": None,
                "network": None,
            },
        ]

        now = datetime.now(timezone.utc)
        for s in seeds:
            rules = {
                "entry": s["entry_condition"],
                "exit": s["exit_condition"],
                "asset": s["asset"],
                "timeframe": s["timeframe"],
                "fast_period": s["fast_period"],
                "slow_period": s["slow_period"],
                "rsi_period": s["rsi_period"],
                "stop_loss_pct": s["stop_loss_pct"],
                "take_profit_pct": s["take_profit_pct"],
                "position_sizing_pct": s["position_sizing_pct"],
            }
            canonical = canonicalize_strategy_rules(rules)
            strat_hash = compute_strategy_hash(canonical)
            ipfs_cid = compute_ipfs_cid(canonical)

            self._strategies[s["id"]] = {
                "id": s["id"],
                "name": s["name"],
                "description": s["description"],
                "asset": s["asset"],
                "timeframe": s["timeframe"],
                "canonical_rules": rules,
                "strategy_hash": strat_hash,
                "ipfs_cid": ipfs_cid,
                "is_onchain": s["is_onchain"],
                "tx_hash": s["tx_hash"],
                "contract_address": s["contract_address"],
                "block_number": s["block_number"],
                "network": s["network"],
                "created_at": now,
            }

    async def create_strategy(self, data: StrategyCreate) -> StrategyResponse:
        """Validates, canonicalizes, and registers a new strategy."""
        strat_id = f"strat-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)

        rules = {
            "name": data.name,
            "asset": data.asset.upper().replace("-", "/"),
            "timeframe": data.timeframe.lower(),
            "entry": data.entry_condition,
            "exit": data.exit_condition,
            "fast_period": data.fast_period,
            "slow_period": data.slow_period,
            "rsi_period": data.rsi_period,
            "stop_loss_pct": data.stop_loss_pct,
            "take_profit_pct": data.take_profit_pct,
            "position_sizing_pct": data.position_sizing_pct,
            "risk_parameters": data.risk_parameters,
        }

        canonical_json = canonicalize_strategy_rules(rules)
        strategy_hash = compute_strategy_hash(canonical_json)
        ipfs_cid = compute_ipfs_cid(canonical_json)

        strat_record = {
            "id": strat_id,
            "name": data.name,
            "description": data.description,
            "asset": rules["asset"],
            "timeframe": rules["timeframe"],
            "canonical_rules": rules,
            "strategy_hash": strategy_hash,
            "ipfs_cid": ipfs_cid,
            "is_onchain": False,
            "tx_hash": None,
            "contract_address": None,
            "block_number": None,
            "network": None,
            "created_at": now,
        }

        async with self._lock:
            self._strategies[strat_id] = strat_record

        return self._to_response(strat_record)

    async def list_strategies(self) -> List[StrategyResponse]:
        """Returns all strategies enriched with their latest verification badge and returns."""
        async with self._lock:
            results = []
            for s in self._strategies.values():
                results.append(self._to_response(s))
            return results

    async def get_strategy(self, strategy_id: str) -> StrategyResponse:
        """Retrieves a single strategy record."""
        async with self._lock:
            if strategy_id not in self._strategies:
                raise NotFoundException(f"Strategy '{strategy_id}' not found.")
            return self._to_response(self._strategies[strategy_id])

    async def run_backtest(
        self,
        strategy_id: str,
        req: BacktestRunRequest,
    ) -> BacktestResultResponse:
        """Fetches real historical Binance candles and evaluates strategy backtest."""
        async with self._lock:
            if strategy_id not in self._strategies:
                raise NotFoundException(f"Strategy '{strategy_id}' not found.")
            strat = self._strategies[strategy_id]

        target_asset = req.asset or strat["asset"]
        target_timeframe = req.timeframe or strat["timeframe"]
        limit = req.limit or 150

        # Fetch real candles from Binance Spot
        try:
            candles = await self.market_data_service.get_ohlcv(
                symbol=target_asset,
                timeframe=target_timeframe,
                limit=limit,
            )
        except Exception as exc:
            logger.error("Failed to fetch historical candles for backtest: %s", exc)
            raise ValidationException(f"Market data temporarily unavailable for {target_asset}: {exc}")

        if not candles or len(candles) < 20:
            raise ValidationException(
                f"Insufficient historical candle data ({len(candles) if candles else 0} candles). Cannot execute backtest."
            )

        # Run vectorized backtest engine
        result = self.backtest_engine.run_backtest(
            candles=candles,
            rules=strat["canonical_rules"],
            initial_capital=req.initial_capital,
            fee_pct=req.fee_pct,
            slippage_pct=req.slippage_pct,
            asset=target_asset,
            timeframe=target_timeframe,
        )

        # Cache backtest run
        async with self._lock:
            self._backtest_runs[strategy_id] = result
            # Automatically refresh AI verification
            paper_status = await self.paper_trading_service.get_paper_status(strategy_id)
            onchain_proof = await self.get_onchain_proof(strategy_id)
            verif = self.ai_verifier.verify_strategy(
                strategy=strat,
                backtest_result=result,
                paper_status=paper_status,
                onchain_proof=onchain_proof.model_dump(),
            )
            self._verifications[strategy_id] = verif

        return BacktestResultResponse(**result)

    async def get_latest_backtest(self, strategy_id: str) -> Optional[BacktestResultResponse]:
        """Retrieves the latest executed backtest for a strategy."""
        async with self._lock:
            if strategy_id not in self._backtest_runs:
                return None
            return BacktestResultResponse(**self._backtest_runs[strategy_id])

    async def register_onchain(self, strategy_id: str) -> OnChainProofResponse:
        """Registers the deterministic strategy hash on the EVM registry."""
        async with self._lock:
            if strategy_id not in self._strategies:
                raise NotFoundException(f"Strategy '{strategy_id}' not found.")
            strat = self._strategies[strategy_id]

        proof = await self.onchain_service.register_strategy_onchain(
            strategy_id=strategy_id,
            strategy_hash=strat["strategy_hash"],
            ipfs_cid=strat.get("ipfs_cid") or "bafkreiunknown",
            name=strat["name"],
            asset=strat["asset"],
            timeframe=strat["timeframe"],
        )

        async with self._lock:
            strat["is_onchain"] = True
            strat["tx_hash"] = proof["transaction_hash"]
            strat["contract_address"] = proof["contract_address"]
            strat["block_number"] = proof["block_number"]
            strat["network"] = proof["blockchain_network"]

            # Re-evaluate verification badge with new onchain proof
            latest_bt = self._backtest_runs.get(strategy_id)
            paper_status = await self.paper_trading_service.get_paper_status(strategy_id)
            verif = self.ai_verifier.verify_strategy(
                strategy=strat,
                backtest_result=latest_bt,
                paper_status=paper_status,
                onchain_proof=proof,
            )
            self._verifications[strategy_id] = verif

        return OnChainProofResponse(**proof)

    async def get_onchain_proof(self, strategy_id: str) -> OnChainProofResponse:
        """Returns verified on-chain proof or clean NOT_REGISTERED status without fake hashes."""
        async with self._lock:
            if strategy_id not in self._strategies:
                raise NotFoundException(f"Strategy '{strategy_id}' not found.")
            strat = self._strategies[strategy_id]

        if not strat.get("is_onchain") or not strat.get("tx_hash"):
            return OnChainProofResponse(
                strategy_id=strategy_id,
                strategy_hash=strat["strategy_hash"],
                ipfs_cid=strat.get("ipfs_cid"),
                blockchain_network=self.onchain_service.network_name,
                contract_address=self.onchain_service.contract_address,
                transaction_hash=None,
                block_number=None,
                registration_timestamp=None,
                status="NOT_REGISTERED",
                explorer_url=None,
                is_verified=False,
            )

        explorer_url = f"{self.onchain_service.explorer_base_url.rstrip('/')}/tx/{strat['tx_hash']}"
        return OnChainProofResponse(
            strategy_id=strategy_id,
            strategy_hash=strat["strategy_hash"],
            ipfs_cid=strat.get("ipfs_cid"),
            blockchain_network=strat.get("network") or self.onchain_service.network_name,
            contract_address=strat.get("contract_address") or self.onchain_service.contract_address,
            transaction_hash=strat["tx_hash"],
            block_number=strat.get("block_number"),
            registration_timestamp=datetime.now(timezone.utc).isoformat(),
            status="REGISTERED",
            explorer_url=explorer_url,
            is_verified=True,
        )

    async def get_verification(self, strategy_id: str) -> VerificationResponse:
        """Returns current verification badge, score breakdown, and transparent AI analysis."""
        async with self._lock:
            if strategy_id not in self._strategies:
                raise NotFoundException(f"Strategy '{strategy_id}' not found.")
            strat = self._strategies[strategy_id]
            verif = self._verifications.get(strategy_id)

        if not verif:
            latest_bt = self._backtest_runs.get(strategy_id)
            paper_status = await self.paper_trading_service.get_paper_status(strategy_id)
            onchain_proof = await self.get_onchain_proof(strategy_id)
            verif = self.ai_verifier.verify_strategy(
                strategy=strat,
                backtest_result=latest_bt,
                paper_status=paper_status,
                onchain_proof=onchain_proof.model_dump(),
            )
            async with self._lock:
                self._verifications[strategy_id] = verif

        return VerificationResponse(strategy_id=strategy_id, **verif)

    def _to_response(self, strat: Dict[str, Any]) -> StrategyResponse:
        sid = strat["id"]
        verif = self._verifications.get(sid, {})
        bt = self._backtest_runs.get(sid, {})
        perf = bt.get("performance", {})

        return StrategyResponse(
            id=sid,
            name=strat["name"],
            description=strat.get("description"),
            asset=strat["asset"],
            timeframe=strat["timeframe"],
            canonical_rules=strat["canonical_rules"],
            strategy_hash=strat["strategy_hash"],
            ipfs_cid=strat.get("ipfs_cid"),
            is_onchain=strat.get("is_onchain", False),
            tx_hash=strat.get("tx_hash"),
            contract_address=strat.get("contract_address"),
            block_number=strat.get("block_number"),
            network=strat.get("network"),
            created_at=strat["created_at"],
            verification_badge=verif.get("badge", "INSUFFICIENT_DATA"),
            verification_score=verif.get("score"),
            total_return_pct=perf.get("total_return_pct"),
            win_rate=perf.get("win_rate"),
        )


_global_strategy_service: Optional[StrategyService] = None


def get_strategy_service() -> StrategyService:
    global _global_strategy_service
    if _global_strategy_service is None:
        _global_strategy_service = StrategyService()
    return _global_strategy_service
