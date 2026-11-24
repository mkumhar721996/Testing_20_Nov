from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Item
from app.schemas import ItemRead
from app.tenancy import current_organisation_id

router = APIRouter()


@router.get("/items", response_model=list[ItemRead])
def list_items(
    session: Session = Depends(get_session),
    organisation_id: UUID = Depends(current_organisation_id),
) -> list[Item]:
    stmt = select(Item).where(Item.organisation_id == organisation_id).order_by(Item.name)
    return list(session.scalars(stmt))
