from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.models import Item, StockMovement
from app.services.stock import InsufficientStock, ItemNotFound, record_movement
from tests.unit.conftest import ORG, OTHER_ORG


def test_records_incoming_movement(session, item_a):
    mv = record_movement(session, ORG, item_a.id, "in", 5)
    assert (mv.item_id, mv.quantity, mv.direction) == (item_a.id, 5, "in")
    assert item_a.on_hand == 8


def test_outgoing_movement_reduces_stock(session, item_a):
    record_movement(session, ORG, item_a.id, "out", 3)
    assert item_a.on_hand == 0


def test_outgoing_above_on_hand_is_refused(session, item_a):
    with pytest.raises(InsufficientStock) as exc:
        record_movement(session, ORG, item_a.id, "out", 5)
    assert exc.value.on_hand == 3
    assert item_a.on_hand == 3
    assert session.scalar(select(func.count()).select_from(StockMovement)) == 0


def test_unknown_item(session):
    with pytest.raises(ItemNotFound):
        record_movement(session, ORG, uuid4(), "in", 1)


def test_other_organisations_item_is_not_found(session, item_a):
    with pytest.raises(ItemNotFound):
        record_movement(session, OTHER_ORG, item_a.id, "in", 1)
