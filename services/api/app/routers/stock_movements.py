from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import StockMovement
from app.schemas import MovementCreate, MovementRead
from app.services.stock import InsufficientStock, ItemNotFound, record_movement
from app.tenancy import current_organisation_id

router = APIRouter()


@router.post("/stock-movements", response_model=MovementRead, status_code=status.HTTP_201_CREATED)
def create_movement(
    payload: MovementCreate,
    session: Session = Depends(get_session),
    organisation_id: UUID = Depends(current_organisation_id),
) -> StockMovement:
    try:
        return record_movement(
            session, organisation_id, payload.item_id, payload.direction, payload.quantity
        )
    except ItemNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "item_not_found"})
    except InsufficientStock as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"code": "insufficient_stock", "on_hand": exc.on_hand},
        )
