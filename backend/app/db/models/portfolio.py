"""Portfolio, asset allocation, and connected public wallet models."""

import uuid
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Float, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.db.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class Portfolio(Base, UUIDMixin, TimestampMixin):
    """Investment portfolio entity."""
    __tablename__ = "portfolios"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    initial_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    current_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="portfolios")
    assets: Mapped[List["PortfolioAsset"]] = relationship(
        "PortfolioAsset",
        back_populates="portfolio",
        cascade="all, delete-orphan",
    )
    wallets: Mapped[List["Wallet"]] = relationship(
        "Wallet",
        back_populates="portfolio",
        cascade="all, delete-orphan",
    )


class Wallet(Base, UUIDMixin, TimestampMixin):
    """Connected public wallet for read-only balance tracking."""
    __tablename__ = "wallets"

    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    address: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    network: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="wallets")
    assets: Mapped[List["PortfolioAsset"]] = relationship(
        "PortfolioAsset",
        back_populates="wallet",
        cascade="all, delete-orphan",
    )


class PortfolioAsset(Base, UUIDMixin, TimestampMixin):
    """Specific asset holding within a portfolio."""
    __tablename__ = "portfolio_assets"

    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    wallet_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("wallets.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    target_weight: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    current_weight: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    avg_entry_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="Manual", nullable=False)
    network: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="assets")
    wallet: Mapped[Optional["Wallet"]] = relationship("Wallet", back_populates="assets")
