"""Initial database migration establishing core GHOST models.

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-09-19 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("role", sa.Enum("USER", "ANALYST", "ADMIN", name="user_role", native_enum=False), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # 2. portfolios
    op.create_table(
        "portfolios",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("initial_balance", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("current_value", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_portfolios_user_id"), "portfolios", ["user_id"], unique=False)

    # 3. portfolio_assets
    op.create_table(
        "portfolio_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("portfolio_id", sa.Uuid(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("target_weight", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("current_weight", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("quantity", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("avg_entry_price", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_portfolio_assets_portfolio_id"), "portfolio_assets", ["portfolio_id"], unique=False)
    op.create_index(op.f("ix_portfolio_assets_symbol"), "portfolio_assets", ["symbol"], unique=False)

    # 4. market_snapshots
    op.create_table(
        "market_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("volume_24h", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("high_24h", sa.Float(), nullable=True),
        sa.Column("low_24h", sa.Float(), nullable=True),
        sa.Column("change_24h", sa.Float(), nullable=True),
        sa.Column("market_cap", sa.Float(), nullable=True),
        sa.Column("liquidity", sa.Float(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_market_snapshots_symbol"), "market_snapshots", ["symbol"], unique=False)
    op.create_index(op.f("ix_market_snapshots_timestamp"), "market_snapshots", ["timestamp"], unique=False)
    op.create_index("ix_snapshot_symbol_timestamp", "market_snapshots", ["symbol", "timestamp"], unique=False)

    # 5. market_candles
    op.create_table(
        "market_candles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("timeframe", sa.String(length=10), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("open", sa.Float(), nullable=False),
        sa.Column("high", sa.Float(), nullable=False),
        sa.Column("low", sa.Float(), nullable=False),
        sa.Column("close", sa.Float(), nullable=False),
        sa.Column("volume", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("trades_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("symbol", "timeframe", "timestamp", name="uq_candle_symbol_timeframe_timestamp"),
    )
    op.create_index(op.f("ix_market_candles_symbol"), "market_candles", ["symbol"], unique=False)
    op.create_index(op.f("ix_market_candles_timeframe"), "market_candles", ["timeframe"], unique=False)
    op.create_index(op.f("ix_market_candles_timestamp"), "market_candles", ["timestamp"], unique=False)
    op.create_index("ix_candle_symbol_tf_ts", "market_candles", ["symbol", "timeframe", "timestamp"], unique=False)

    # 6. signals
    op.create_table(
        "signals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("direction", sa.String(length=20), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("strength", sa.Float(), nullable=False),
        sa.Column("time_horizon", sa.String(length=20), nullable=False, server_default="SHORT_TERM"),
        sa.Column("reasons", sa.JSON(), nullable=False),
        sa.Column("features_snapshot", sa.JSON(), nullable=False),
        sa.Column("model_version", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_signals_symbol"), "signals", ["symbol"], unique=False)
    op.create_index(op.f("ix_signals_timestamp"), "signals", ["timestamp"], unique=False)
    op.create_index("ix_signal_symbol_timestamp", "signals", ["symbol", "timestamp"], unique=False)
    op.create_index("ix_signal_direction", "signals", ["direction"], unique=False)

    # 7. risk_analyses
    op.create_table(
        "risk_analyses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.String(length=100), nullable=False),
        sa.Column("overall_risk", sa.Float(), nullable=False),
        sa.Column("volatility", sa.Float(), nullable=False),
        sa.Column("var_95", sa.Float(), nullable=True),
        sa.Column("cvar_95", sa.Float(), nullable=True),
        sa.Column("max_drawdown", sa.Float(), nullable=True),
        sa.Column("sharpe_ratio", sa.Float(), nullable=True),
        sa.Column("sortino_ratio", sa.Float(), nullable=True),
        sa.Column("beta", sa.Float(), nullable=True),
        sa.Column("concentration_risk", sa.Float(), nullable=True),
        sa.Column("metrics_payload", sa.JSON(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_risk_analyses_target_id"), "risk_analyses", ["target_id"], unique=False)
    op.create_index(op.f("ix_risk_analyses_timestamp"), "risk_analyses", ["timestamp"], unique=False)
    op.create_index("ix_risk_target_timestamp", "risk_analyses", ["target_type", "target_id", "timestamp"], unique=False)

    # 8. research_results
    op.create_table(
        "research_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("study_type", sa.String(length=50), nullable=False),
        sa.Column("parameters", sa.JSON(), nullable=False),
        sa.Column("findings", sa.JSON(), nullable=False),
        sa.Column("methodology", sa.Text(), nullable=False),
        sa.Column("assumptions", sa.Text(), nullable=True),
        sa.Column("data_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_research_results_symbol"), "research_results", ["symbol"], unique=False)
    op.create_index(op.f("ix_research_results_study_type"), "research_results", ["study_type"], unique=False)
    op.create_index(op.f("ix_research_results_timestamp"), "research_results", ["timestamp"], unique=False)
    op.create_index("ix_research_symbol_type", "research_results", ["symbol", "study_type"], unique=False)

    # 9. backtest_runs
    op.create_table(
        "backtest_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("strategy_name", sa.String(length=100), nullable=False),
        sa.Column("parameters", sa.JSON(), nullable=False),
        sa.Column("initial_capital", sa.Float(), nullable=False),
        sa.Column("final_capital", sa.Float(), nullable=False),
        sa.Column("total_return", sa.Float(), nullable=False),
        sa.Column("annualized_return", sa.Float(), nullable=True),
        sa.Column("max_drawdown", sa.Float(), nullable=False),
        sa.Column("sharpe", sa.Float(), nullable=True),
        sa.Column("sortino", sa.Float(), nullable=True),
        sa.Column("win_rate", sa.Float(), nullable=True),
        sa.Column("profit_factor", sa.Float(), nullable=True),
        sa.Column("total_trades", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("trades_log", sa.JSON(), nullable=False),
        sa.Column("equity_curve", sa.JSON(), nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_backtest_runs_strategy_name"), "backtest_runs", ["strategy_name"], unique=False)
    op.create_index("ix_backtest_strategy_created", "backtest_runs", ["strategy_name", "created_at"], unique=False)

    # 10. model_versions
    op.create_table(
        "model_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("model_id", sa.String(length=100), nullable=False),
        sa.Column("model_version", sa.String(length=50), nullable=False),
        sa.Column("task_type", sa.String(length=50), nullable=False),
        sa.Column("feature_version", sa.String(length=50), nullable=False),
        sa.Column("dataset_version", sa.String(length=50), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("parameters", sa.JSON(), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="CANDIDATE"),
        sa.Column("training_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_model_versions_model_id"), "model_versions", ["model_id"], unique=False)
    op.create_index("ix_model_id_version", "model_versions", ["model_id", "model_version"], unique=False)
    op.create_index("ix_model_status", "model_versions", ["status"], unique=False)

    # 11. audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_timestamp"), "audit_logs", ["timestamp"], unique=False)
    op.create_index("ix_audit_action_timestamp", "audit_logs", ["action", "timestamp"], unique=False)


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("model_versions")
    op.drop_table("backtest_runs")
    op.drop_table("research_results")
    op.drop_table("risk_analyses")
    op.drop_table("signals")
    op.drop_table("market_candles")
    op.drop_table("market_snapshots")
    op.drop_table("portfolio_assets")
    op.drop_table("portfolios")
    op.drop_table("users")
