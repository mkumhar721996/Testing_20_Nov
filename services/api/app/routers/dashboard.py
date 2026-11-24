from datetime import UTC, datetime, time
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Item, StockMovement
from app.schemas import DashboardRead, RecentMovement
from app.tenancy import current_organisation_id

router = APIRouter()

RECENT_LIMIT = 10


@router.get("/dashboard", response_model=DashboardRead)
def dashboard(
    session: Session = Depends(get_session),
    organisation_id: UUID = Depends(current_organisation_id),
) -> DashboardRead:
    items_in_stock, item_count = session.execute(
        select(func.coalesce(func.sum(Item.on_hand), 0), func.count()).where(
            Item.organisation_id == organisation_id
        )
    ).one()
    start_of_today = datetime.combine(datetime.now(UTC).date(), time.min, tzinfo=UTC)
    movements_today = session.scalar(
        select(func.count())
        .select_from(StockMovement)
        .where(
            StockMovement.organisation_id == organisation_id,
            StockMovement.occurred_at >= start_of_today,
        )
    )
    rows = session.execute(
        select(StockMovement, Item.name, Item.bin)
        .join(Item, Item.id == StockMovement.item_id)
        .where(StockMovement.organisation_id == organisation_id)
        .order_by(StockMovement.occurred_at.desc())
        .limit(RECENT_LIMIT)
    )
    return DashboardRead(
        items_in_stock=items_in_stock,
        movements_today=movements_today or 0,
        item_count=item_count,
        recent_movements=[
            RecentMovement(
                id=m.id,
                occurred_at=m.occurred_at,
                item_name=name,
                bin=bin_,
                direction=m.direction,
                quantity=m.quantity,
            )
            for m, name, bin_ in rows
        ],
    )
