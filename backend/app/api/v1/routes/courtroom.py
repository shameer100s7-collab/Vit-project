"""Courtroom adversarial market reasoning endpoints."""

from typing import List
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_request_id
from app.schemas.common import StandardSuccessResponse
from app.schemas.courtroom import CourtroomCase, CourtroomCaseCreate
from app.services.courtroom import CourtroomService, get_courtroom_service

router = APIRouter()


@router.post(
    "/cases",
    response_model=StandardSuccessResponse[CourtroomCase],
    summary="Convene Courtroom Case",
    description=(
        "Initiates an adversarial Courtroom proceeding against a user's market thesis. "
        "Extracts real market evidence from Binance Spot, presents Prosecution counter-arguments, "
        "Defense supporting arguments, a side-by-side Cross-Examination matrix, and an objective "
        "verdict with explicit invalidation conditions."
    ),
)
async def create_courtroom_case(
    submission: CourtroomCaseCreate,
    service: CourtroomService = Depends(get_courtroom_service),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[CourtroomCase]:
    """Convenes a new adversarial Courtroom session."""
    case = await service.create_case(submission)
    return StandardSuccessResponse(
        success=True,
        data=case,
        metadata={
            "request_id": request_id,
            "case_id": case.case_id,
            "symbol": case.symbol,
            "verdict": case.verdict.value,
            "evidence_count": case.evidence_count,
        },
    )


@router.get(
    "/cases/{case_id}",
    response_model=StandardSuccessResponse[CourtroomCase],
    summary="Retrieve Courtroom Case",
    description="Retrieves the complete adversarial record of a previously convened Courtroom case.",
)
async def get_courtroom_case(
    case_id: str,
    service: CourtroomService = Depends(get_courtroom_service),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[CourtroomCase]:
    """Retrieves an existing Courtroom case by its ID."""
    case = await service.get_case(case_id)
    return StandardSuccessResponse(
        success=True,
        data=case,
        metadata={
            "request_id": request_id,
            "case_id": case.case_id,
            "symbol": case.symbol,
            "verdict": case.verdict.value,
        },
    )


@router.get(
    "/cases",
    response_model=StandardSuccessResponse[List[CourtroomCase]],
    summary="List Courtroom Cases",
    description="Retrieves a list of recent Courtroom cases.",
)
async def list_courtroom_cases(
    limit: int = Query(20, ge=1, le=50, description="Max cases to return"),
    service: CourtroomService = Depends(get_courtroom_service),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[List[CourtroomCase]]:
    """Lists recent Courtroom cases."""
    cases = await service.list_cases(limit=limit)
    return StandardSuccessResponse(
        success=True,
        data=cases,
        metadata={
            "request_id": request_id,
            "count": len(cases),
        },
    )
