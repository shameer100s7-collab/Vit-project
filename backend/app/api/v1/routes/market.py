"""Market data ingestion and real-time intelligence endpoints."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_request_id
from app.db.database import get_db
from app.schemas.common import StandardSuccessResponse
from app.schemas.market import (
    CanonicalAssetMetadata,
    CanonicalCandle,
    CanonicalMarketOverview,
    CanonicalOrderBook,
    CanonicalPrice,
    CanonicalVolume,
    TradableSymbolItem,
)
from app.services.market_data import MarketDataService, get_market_data_service

router = APIRouter()


@router.get(
    "/overview",
    response_model=StandardSuccessResponse[CanonicalMarketOverview],
    summary="Market Overview",
    description="Returns aggregate market overview across tracked cryptocurrency assets.",
)
async def get_market_overview(
    service: MarketDataService = Depends(get_market_data_service),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[CanonicalMarketOverview]:
    """Retrieves normalized cross-asset market summary."""
    overview = await service.get_market_overview()
    return StandardSuccessResponse(
        success=True,
        data=overview,
        metadata={"request_id": request_id, "provider": service.provider.name},
    )


@router.get(
    "/symbols",
    response_model=StandardSuccessResponse[List[TradableSymbolItem]],
    summary="Tradable Market Symbols",
    description="Returns active tradable symbols discovered from authoritative exchange provider.",
)
async def get_tradable_symbols(
    service: MarketDataService = Depends(get_market_data_service),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[List[TradableSymbolItem]]:
    """Retrieves discovered active tradable symbols."""
    symbols = await service.get_tradable_symbols()
    return StandardSuccessResponse(
        success=True,
        data=symbols,
        metadata={"request_id": request_id, "provider": service.provider.name, "count": len(symbols)},
    )


@router.get(
    "/{symbol}",
    response_model=StandardSuccessResponse[CanonicalPrice],
    summary="Asset Current Price",
    description="Returns real-time normalized price quotation for a specified ticker symbol.",
)
async def get_asset_price(
    symbol: str,
    service: MarketDataService = Depends(get_market_data_service),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[CanonicalPrice]:
    """Retrieves current price and records point-in-time snapshot."""
    price = await service.get_current_price(symbol, session=session)
    return StandardSuccessResponse(
        success=True,
        data=price,
        metadata={"request_id": request_id, "provider": service.provider.name},
    )


@router.get(
    "/{symbol}/ohlcv",
    response_model=StandardSuccessResponse[List[CanonicalCandle]],
    summary="Historical and Live OHLCV Candles",
    description="Retrieves chronological market candles for technical indicators and quantitative modeling.",
)
async def get_asset_ohlcv(
    symbol: str,
    timeframe: str = Query("1h", description="Candle interval (e.g., 1m, 5m, 15m, 1h, 4h, 1d)"),
    limit: int = Query(100, ge=1, le=1000, description="Total number of candle periods"),
    service: MarketDataService = Depends(get_market_data_service),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[List[CanonicalCandle]]:
    """Retrieves normalized OHLCV time series data."""
    candles = await service.get_ohlcv(symbol, timeframe=timeframe, limit=limit, session=session)
    return StandardSuccessResponse(
        success=True,
        data=candles,
        metadata={
            "request_id": request_id,
            "provider": service.provider.name,
            "count": len(candles),
            "timeframe": timeframe,
        },
    )


@router.get(
    "/{symbol}/orderbook",
    response_model=StandardSuccessResponse[CanonicalOrderBook],
    summary="Depth of Market Orderbook",
    description="Retrieves normalized orderbook depth for liquidity and market microstructure analysis.",
)
async def get_asset_orderbook(
    symbol: str,
    depth: int = Query(20, ge=5, le=100, description="Orderbook level depth"),
    service: MarketDataService = Depends(get_market_data_service),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[CanonicalOrderBook]:
    """Retrieves orderbook with bid-ask spread and cumulative depth."""
    orderbook = await service.get_orderbook(symbol, depth=depth)
    return StandardSuccessResponse(
        success=True,
        data=orderbook,
        metadata={"request_id": request_id, "provider": service.provider.name},
    )


@router.get(
    "/{symbol}/volume",
    response_model=StandardSuccessResponse[CanonicalVolume],
    summary="24h Volume and Turnover",
    description="Retrieves normalized 24-hour volume and percentage price change.",
)
async def get_asset_volume(
    symbol: str,
    service: MarketDataService = Depends(get_market_data_service),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[CanonicalVolume]:
    """Retrieves volume metrics."""
    vol = await service.get_volume(symbol)
    return StandardSuccessResponse(
        success=True,
        data=vol,
        metadata={"request_id": request_id, "provider": service.provider.name},
    )


@router.get(
    "/{symbol}/metadata",
    response_model=StandardSuccessResponse[CanonicalAssetMetadata],
    summary="Asset Metadata & Specifications",
    description="Retrieves static asset parameters, precision decimals, and minimum order limits.",
)
async def get_asset_metadata(
    symbol: str,
    service: MarketDataService = Depends(get_market_data_service),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[CanonicalAssetMetadata]:
    """Retrieves asset metadata."""
    metadata = await service.get_asset_metadata(symbol)
    return StandardSuccessResponse(
        success=True,
        data=metadata,
        metadata={"request_id": request_id},
    )


@router.get(
    "/provider/health",
    response_model=StandardSuccessResponse[Dict[str, Any]],
    summary="Market Provider Health Probe",
    description="Checks operational and connectivity status of the active market data provider.",
)
async def get_provider_health(
    service: MarketDataService = Depends(get_market_data_service),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[Dict[str, Any]]:
    """Retrieves provider health status."""
    health_status = await service.check_health()
    return StandardSuccessResponse(
        success=True,
        data=health_status,
        metadata={"request_id": request_id},
    )
