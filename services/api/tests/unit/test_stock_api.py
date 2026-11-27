from uuid import uuid4

from app.models import Item
from tests.unit.conftest import OTHER_ORG


def body(item, quantity=5, direction="in"):
    return {"item_id": str(item.id), "quantity": quantity, "direction": direction}


async def test_post_records_movement(client, item_a):
    resp = await client.post("/stock-movements", json=body(item_a))
    assert resp.status_code == 201
    assert resp.json()["quantity"] == 5 and resp.json()["direction"] == "in"


async def test_dashboard_includes_the_movement(client, item_a):
    before = (await client.get("/dashboard")).json()
    await client.post("/stock-movements", json=body(item_a))
    after = (await client.get("/dashboard")).json()
    assert after["items_in_stock"] == before["items_in_stock"] + 5
    assert after["movements_today"] == before["movements_today"] + 1
    assert after["item_count"] == 1
    assert after["recent_movements"][0]["item_name"] == "Item A"
    assert after["recent_movements"][0]["bin"] == "A-01"


async def test_dashboard_excludes_other_organisations(client, session, item_a):
    session.add(Item(id=uuid4(), organisation_id=OTHER_ORG, name="X", bin="X-1", on_hand=100))
    session.commit()
    assert (await client.get("/dashboard")).json()["items_in_stock"] == 3
    assert [i["name"] for i in (await client.get("/items")).json()] == ["Item A"]


async def test_zero_and_negative_quantity_are_refused(client, item_a):
    for q in (0, -3):
        resp = await client.post("/stock-movements", json=body(item_a, q))
        assert resp.status_code == 422


async def test_bad_direction_is_refused(client, item_a):
    resp = await client.post("/stock-movements", json=body(item_a, 1, "sideways"))
    assert resp.status_code == 422


async def test_out_above_on_hand_is_409(client, item_a):
    resp = await client.post("/stock-movements", json=body(item_a, 5, "out"))
    assert resp.status_code == 409
    assert resp.json()["detail"] == {"code": "insufficient_stock", "on_hand": 3}


async def test_other_organisations_item_is_404(client, session):
    other = Item(id=uuid4(), organisation_id=OTHER_ORG, name="X", bin="X-1", on_hand=9)
    session.add(other)
    session.commit()
    resp = await client.post("/stock-movements", json=body(other))
    assert resp.status_code == 404
    assert resp.json()["detail"] == {"code": "item_not_found"}
