import httpx
import pytest

from app.auth import get_current_principal
from app.db import get_session
from app.main import app


@pytest.fixture
def api(session):
    app.dependency_overrides[get_session] = lambda: session

    def as_principal(principal):
        app.dependency_overrides[get_current_principal] = lambda: principal
        return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")

    yield as_principal
    app.dependency_overrides.clear()


async def test_clock_in_out_then_list_and_isolation(api, principal_a, principal_b):
    async with api(principal_a) as client:
        assert (await client.post("/attendance/clock-in")).status_code == 201
        assert (await client.post("/attendance/clock-out")).status_code == 200
        rows = (await client.get("/attendance/records")).json()
    assert len(rows) == 1
    assert rows[0]["clock_in_at"] and rows[0]["clock_out_at"] and rows[0]["date"]

    async with api(principal_b) as client:
        assert (await client.get("/attendance/records")).json() == []
