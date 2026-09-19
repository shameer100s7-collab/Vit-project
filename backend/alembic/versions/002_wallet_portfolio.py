"""Add wallets table and source/network fields to portfolio_assets.

Revision ID: 002_wallet_portfolio
Revises: 001_initial_schema
Create Date: 2026-09-19 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "002_wallet_portfolio"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. create wallets table
    op.create_table(
        "wallets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("portfolio_id", sa.Uuid(), nullable=False),
        sa.Column("address", sa.String(length=128), nullable=False),
        sa.Column("network", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_wallets_address"), "wallets", ["address"], unique=False)
    op.create_index(op.f("ix_wallets_portfolio_id"), "wallets", ["portfolio_id"], unique=False)

    # 2. add columns to portfolio_assets
    op.add_column("portfolio_assets", sa.Column("wallet_id", sa.Uuid(), nullable=True))
    op.add_column("portfolio_assets", sa.Column("source", sa.String(length=20), server_default="Manual", nullable=False))
    op.add_column("portfolio_assets", sa.Column("network", sa.String(length=50), nullable=True))
    op.create_foreign_key("fk_portfolio_assets_wallet_id", "portfolio_assets", "wallets", ["wallet_id"], ["id"], ondelete="CASCADE")
    op.create_index(op.f("ix_portfolio_assets_wallet_id"), "portfolio_assets", ["wallet_id"], unique=False)


def downgrade() -> None:
    op.drop_constraint("fk_portfolio_assets_wallet_id", "portfolio_assets", type_="foreignkey")
    op.drop_index(op.f("ix_portfolio_assets_wallet_id"), table_name="portfolio_assets")
    op.drop_column("portfolio_assets", "network")
    op.drop_column("portfolio_assets", "source")
    op.drop_column("portfolio_assets", "wallet_id")
    op.drop_table("wallets")
