"""AI Verification and Anomaly Detection Engine.

Analyzes quantitative backtest results, live paper trading outcomes, and on-chain
records using verifiable heuristics and transparent statistical models without hallucinating values.
"""

from typing import Any, Dict, List, Optional
import numpy as np

from app.core.logging import get_logger

logger = get_logger("ghost.ai_verification")


class AIVerificationEngine:
    """Performs multi-dimensional verification, anomaly detection, and risk explanation."""

    def verify_strategy(
        self,
        strategy: Dict[str, Any],
        backtest_result: Optional[Dict[str, Any]],
        paper_status: Optional[Dict[str, Any]],
        onchain_proof: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Synthesizes comprehensive verification report, transparent score, and badges."""
        anomalies: List[Dict[str, Any]] = []
        failure_conditions: List[Dict[str, Any]] = []
        score_breakdown: Dict[str, Any] = {
            "data_completeness": 0,
            "backtest_coverage": 0,
            "sample_size": 0,
            "onchain_proof": 0,
            "anomaly_clearance": 0,
            "max_score": 100,
        }

        # 1. Handle Missing / Insufficient Backtest
        if not backtest_result or not backtest_result.get("performance"):
            return {
                "badge": "INSUFFICIENT_DATA",
                "score": None,
                "score_breakdown": score_breakdown,
                "performance_analysis": "INSUFFICIENT DATA: No backtest run has been completed for this strategy yet.",
                "risk_analysis": "INSUFFICIENT DATA: Risk cannot be quantified without historical simulation.",
                "overfitting_analysis": "INSUFFICIENT DATA: Parameter robustness cannot be evaluated.",
                "anomalies": [],
                "failure_conditions": [],
                "data_provenance": {
                    "status": "Awaiting backtest execution",
                    "source": "None",
                },
            }

        perf = backtest_result["performance"]
        trades = backtest_result.get("trades_log", [])
        total_trades = perf.get("total_trades", 0)
        win_rate = perf.get("win_rate", 0.0)
        max_dd = perf.get("max_drawdown", 0.0)
        sharpe = perf.get("sharpe_ratio", 0.0)
        total_return = perf.get("total_return_pct", 0.0)
        candle_count = backtest_result.get("candle_count", 0)

        # 2. Score Component: Data Completeness (up to 20 pts)
        if candle_count >= 100:
            score_breakdown["data_completeness"] = 20
        elif candle_count >= 50:
            score_breakdown["data_completeness"] = 14
        elif candle_count >= 20:
            score_breakdown["data_completeness"] = 8
        else:
            score_breakdown["data_completeness"] = 0

        # 3. Score Component: Sample Size (up to 20 pts)
        if total_trades >= 30:
            score_breakdown["sample_size"] = 20
        elif total_trades >= 15:
            score_breakdown["sample_size"] = 15
        elif total_trades >= 8:
            score_breakdown["sample_size"] = 8
        else:
            score_breakdown["sample_size"] = 2

        # 4. Score Component: Backtest Coverage & Health (up to 25 pts)
        cov_score = 0
        if max_dd < 15.0:
            cov_score += 10
        elif max_dd < 25.0:
            cov_score += 6
        elif max_dd < 40.0:
            cov_score += 2

        if sharpe >= 1.5:
            cov_score += 10
        elif sharpe >= 1.0:
            cov_score += 7
        elif sharpe >= 0.5:
            cov_score += 4

        if perf.get("profit_factor", 1.0) >= 1.3:
            cov_score += 5
        elif perf.get("profit_factor", 1.0) >= 1.0:
            cov_score += 3
        score_breakdown["backtest_coverage"] = min(25, cov_score)

        # 5. Score Component: On-Chain Proof (up to 15 pts)
        is_onchain = onchain_proof and onchain_proof.get("is_verified", False)
        if is_onchain and onchain_proof.get("transaction_hash"):
            score_breakdown["onchain_proof"] = 15
        else:
            score_breakdown["onchain_proof"] = 0

        # 6. Anomaly Detection Engine (Transparent Rule-Based Checks)
        anomaly_points = 20
        has_critical_anomaly = False

        # Anomaly 1: Cherry-Picking Check
        if trades and total_return > 0:
            net_pnl = perf.get("net_pnl", 1.0)
            largest_win = perf.get("largest_win", 0.0)
            if net_pnl > 0 and (largest_win / net_pnl) > 0.80 and total_trades > 3:
                anomalies.append({
                    "type": "CHERRY_PICKED_DEPENDENCY",
                    "severity": "CRITICAL",
                    "description": f"Single largest winning trade (${largest_win:,.2f}) accounts for {largest_win/net_pnl*100:.1f}% of total net profit.",
                    "evidence": f"Total profit ${net_pnl:,.2f} vs top trade ${largest_win:,.2f}",
                })
                has_critical_anomaly = True
                anomaly_points -= 10

        # Anomaly 2: Unrealistic 100% Win Rate Check
        if total_trades >= 5 and win_rate >= 99.0:
            anomalies.append({
                "type": "STATISTICALLY_IMPROBABLE_PERFECTION",
                "severity": "CRITICAL",
                "description": f"Reported win rate is {win_rate:.1f}% across {total_trades} trades with zero recorded losses, indicating potential overfitting or missing loss trades.",
                "evidence": f"0 losing trades recorded out of {total_trades} executions.",
            })
            has_critical_anomaly = True
            anomaly_points -= 10

        # Anomaly 3: Backtest vs Paper Divergence Check
        if paper_status and paper_status.get("total_trades", 0) >= 5:
            paper_wr = paper_status.get("win_rate", 0.0)
            wr_diff = abs(win_rate - paper_wr)
            if wr_diff > 25.0:
                anomalies.append({
                    "type": "PAPER_LIVE_DIVERGENCE",
                    "severity": "HIGH",
                    "description": f"Live paper trading win rate ({paper_wr:.1f}%) diverges by {wr_diff:.1f}% from historical backtest win rate ({win_rate:.1f}%).",
                    "evidence": f"Backtest WR: {win_rate:.1f}%, Paper WR: {paper_wr:.1f}%",
                })
                anomaly_points -= 6

        score_breakdown["anomaly_clearance"] = max(0, anomaly_points)

        total_score = sum([
            score_breakdown["data_completeness"],
            score_breakdown["sample_size"],
            score_breakdown["backtest_coverage"],
            score_breakdown["onchain_proof"],
            score_breakdown["anomaly_clearance"],
        ])

        # 7. Transparent Verification Badge Assignment
        if has_critical_anomaly:
            badge = "ANOMALY_DETECTED"
        elif total_trades < 6 or candle_count < 30:
            badge = "INSUFFICIENT_DATA"
        elif total_score >= 75 and is_onchain and total_trades >= 12:
            badge = "VERIFIED"
        elif total_score >= 45:
            badge = "PARTIALLY_VERIFIED"
        else:
            badge = "UNDER_REVIEW"

        # 8. Strategy Failure Condition Analysis
        losing_trades = [t for t in trades if t.get("pnl", 0) <= 0]
        if losing_trades:
            # Condition: Stop-Loss triggers
            sl_trades = [t for t in losing_trades if t.get("exit_reason") == "STOP_LOSS"]
            if sl_trades:
                failure_conditions.append({
                    "condition": "Sharp Adverse Momentum / Stop-Loss Breach",
                    "observed_performance": f"{len(sl_trades)} stop-out events causing average loss of ${abs(sum(t['pnl'] for t in sl_trades)/len(sl_trades)):,.2f}.",
                    "occurrences": len(sl_trades),
                    "evidence": f"Triggered when price dropped {strategy.get('canonical_rules', {}).get('stop_loss_pct', 2.0)}% beneath entry point.",
                    "affected_period": f"{sl_trades[0].get('entry_time', '')[:10]} to {sl_trades[-1].get('exit_time', '')[:10]}",
                })

            # Condition: Prolonged Flat / Trend Reversal
            ind_loss_trades = [t for t in losing_trades if t.get("exit_reason") in ("INDICATOR_EXIT", "END_OF_PERIOD")]
            if ind_loss_trades:
                failure_conditions.append({
                    "condition": "Sideways Consolidation & Indicator Whipsaw",
                    "observed_performance": f"{len(ind_loss_trades)} false breakouts resulting in net loss of ${abs(sum(t['pnl'] for t in ind_loss_trades)):,.2f}.",
                    "occurrences": len(ind_loss_trades),
                    "evidence": "Fast EMA reverted below Slow EMA before meaningful trend continuation occurred.",
                    "affected_period": f"{ind_loss_trades[0].get('entry_time', '')[:10]}",
                })

        # 9. Dynamic AI Explanations & Risk Explainer
        perf_summary = (
            f"During the tested period ({backtest_result.get('start_date', '')[:10]} to {backtest_result.get('end_date', '')[:10]}), "
            f"the strategy executed {total_trades} trades yielding a net return of {total_return:+.2f}% "
            f"(P&L: ${perf.get('net_pnl', 0):+,.2f}) with a win rate of {win_rate:.1f}% and profit factor of {perf.get('profit_factor', 1.0):.2f}."
        )

        risk_summary = (
            f"Maximum peak-to-trough historical drawdown reached {max_dd:.2f}%. "
            f"Annualized Sharpe ratio is {sharpe:.2f} and Sortino ratio is {perf.get('sortino_ratio', 0.0):.2f}. "
            f"Largest winning trade was +${perf.get('largest_win', 0.0):,.2f}, while largest drawdown loss was -${abs(perf.get('largest_loss', 0.0)):,.2f}. "
            "Past historical backtest metrics reflect simulated rule behavior under historical exchange conditions and do NOT guarantee future profitability."
        )

        overfitting_summary = (
            f"With {total_trades} trades across {candle_count} bars, parameter sample density is "
            f"{'adequate' if total_trades >= 20 else 'low'}. "
            + ("No single-trade curve fitting was detected." if not has_critical_anomaly else "Curve-fitting warning: Performance is skewed by atypical outliers.")
        )

        return {
            "badge": badge,
            "score": total_score,
            "score_breakdown": score_breakdown,
            "performance_analysis": perf_summary,
            "risk_analysis": risk_summary,
            "overfitting_analysis": overfitting_summary,
            "anomalies": anomalies,
            "failure_conditions": failure_conditions,
            "data_provenance": backtest_result.get("data_provenance", {}),
        }


_global_ai_verification_engine: Optional[AIVerificationEngine] = None


def get_ai_verification_engine() -> AIVerificationEngine:
    global _global_ai_verification_engine
    if _global_ai_verification_engine is None:
        _global_ai_verification_engine = AIVerificationEngine()
    return _global_ai_verification_engine
