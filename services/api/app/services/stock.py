from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Item, StockMovement


class ItemNotFound(Exception):
    pass


class InsufficientStock(Exception):
    def __init__(self, on_hand: int) -> None:
        super().__init__(f"only {on_hand} on hand")
        self.on_hand = on_hand


def record_movement(
    session: Session,
    organisation_id: UUID,
    item_id: UUID,
    direction: Literal["in", "out"],
    quantity: int,
) -> StockMovement:
    """Record one movement and adjust on-hand stock in a single transaction."""
    item = session.scalar(
        select(Item)
        .where(Item.id == item_id, Item.organisation_id == organisation_id)
        .with_for_update()
    )
    if item is None:
        raise ItemNotFound()
    if direction == "out" and quantity > item.on_hand:
        session.rollback()
        raise InsufficientStock(item.on_hand)
    item.on_hand += quantity if direction == "in" else -quantity
    movement = StockMovement(
        id=uuid4(),
        organisation_id=organisation_id,
        item_id=item.id,
        direction=direction,
        quantity=quantity,
        occurred_at=datetime.now(UTC),
    )
    session.add(movement)
    session.commit()
    return movement
