from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Item, StockMovement
from tests.unit.conftest import ORG


def test_negative_on_hand_is_rejected(session):
    session.add(Item(id=uuid4(), organisation_id=ORG, name="A", bin="A-1", on_hand=-1))
    with pytest.raises(IntegrityError):
        session.commit()


def test_zero_quantity_movement_is_rejected(session, item_a):
    session.add(
        StockMovement(
            id=uuid4(),
            organisation_id=ORG,
            item_id=item_a.id,
            direction="in",
            quantity=0,
            occurred_at=datetime.now(UTC),
        )
    )
    with pytest.raises(IntegrityError):
        session.commit()
