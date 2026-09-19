"""Pydantic schemas for portfolio management and wallet tracking."""

import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class AddAssetRequest(BaseModel):
    """Payload to add a manual asset holding to portfolio."""
    symbol: str = Field(..., description="Asset symbol, e.g. BTC, ETH, SOL, USDT")
    quantity: float = Field(..., gt=0, description="Quantity held")
    avg_entry_price: Optional[float] = Field(default=0.0, ge=0, description="Average entry price if available")
    network: Optional[str] = Field(default=None, description="Blockchain network label")


class UpdateAssetRequest(BaseModel):
    """Payload to update an existing asset holding."""
    quantity: float = Field(..., gt=0, description="Updated asset quantity")
    avg_entry_price: Optional[float] = Field(default=0.0, ge=0, description="Updated average entry price")


class AddWalletRequest(BaseModel):
    """Payload to connect a public wallet for read-only tracking."""
    address: str = Field(..., description="Public wallet address")
    network: str = Field(..., description="Blockchain network, e.g. Ethereum, Bitcoin, Solana")
    label: Optional[str] = Field(default=None, description="Custom label for the wallet")


class WalletResponse(BaseModel):
    """Public wallet account response."""
    id: uuid.UUID
    address: str
    network: str
    label: Optional[str] = None
    asset_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioAssetResponse(BaseModel):
    """Asset holding response within portfolio."""
    id: uuid.UUID
    symbol: str
    quantity: float
    avg_entry_price: float = 0.0
    source: str = "Manual"
    network: Optional[str] = None
    wallet_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioResponse(BaseModel):
    """User portfolio response."""
    id: uuid.UUID
    name: str
    currency: str = "USD"
    assets: List[PortfolioAssetResponse] = []
    wallets: List[WalletResponse] = []
    updated_at: datetime

    model_config = {"from_attributes": True}
