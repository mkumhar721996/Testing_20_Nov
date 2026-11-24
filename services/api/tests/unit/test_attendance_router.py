import httpx
import pytest

from app.auth import get_current_principal
from app.db import get_session
from app.main import app
from app.services.attendance import list_records


@pytest.fixture
def client_for(session):
    app.dependency_overrides[get_session] = lambda: session

    def make(principal=None):
        if principal is not None:
            app.dependency_overrides[get_current_principal] = lambda: principal
        transport = httpx.ASGITransport(app=app)
        return httpx.AsyncClient(transport=transport, base_url="http://test")

    yield make
    app.dependency_overrides.clear()


async def test_clock_in_returns_201_open_record(client_for, principal_a):  # AC1
    async with client_for(principal_a) as client:
        r = await client.post("/attendance/clock-in")
    assert r.status_code == 201
    assert r.json()["clock_out_at"] is None


async def test_records_after_clock_in_and_out(client_for, principal_a):  # AC2/3
    async with client_for(principal_a) as client:
        await client.post("/attendance/clock-in")
        out = await client.post("/attendance/clock-out")
        body = (await client.get("/attendance/records")).json()
    assert out.status_code == 200
    assert body[0].keys() >= {"date", "clock_in_at", "clock_out_at"}
    assert body[0]["clock_out_at"] is not None


@pytest.mark.parametrize("path", ["clock-in", "clock-out"])
async def test_naming_other_employee_refused(client_for, session, principal_a, principal_b, path):  # AC5
    async with client_for(principal_a) as client:
        r = await client.post(f"/attendance/{path}", json={"employee_id": str(principal_b.employee_id)})
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "other_employee"
    assert list_records(session, principal_b) == []
    assert list_records(session, principal_a) == []


async def test_naming_self_is_allowed(client_for, principal_a):
    async with client_for(principal_a) as client:
        r = await client.post("/attendance/clock-in", json={"employee_id": str(principal_a.employee_id)})
    assert r.status_code == 201


async def test_no_token_is_401(client_for):  # AC5
    async with client_for() as client:
        r = await client.post("/attendance/clock-in")
        g = await client.get("/attendance/records")
    assert r.status_code == 401
    assert g.status_code == 401


async def test_second_clock_in_is_409(client_for, principal_a):  # AC6/7
    async with client_for(principal_a) as client:
        first = (await client.post("/attendance/clock-in")).json()
        second = await client.post("/attendance/clock-in")
        body = (await client.get("/attendance/records")).json()
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "already_clocked_in"
    assert [b["clock_in_at"] for b in body] == [first["clock_in_at"]]


async def test_clock_out_when_clocked_out_is_409(client_for, principal_a):  # AC8/9
    async with client_for(principal_a) as client:
        r = await client.post("/attendance/clock-out")
        body = (await client.get("/attendance/records")).json()
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "not_clocked_in"
    assert body == []


async def test_records_only_own(client_for, principal_a, principal_b):  # AC4
    async with client_for(principal_b) as client:
        await client.post("/attendance/clock-in")
    async with client_for(principal_a) as client:
        body = (await client.get("/attendance/records")).json()
    assert body == []
