import json
import uuid

import pytest
from sqlalchemy import func, select

from app.models import Account, Employee
from tests.unit.conftest import ORG, OTHER_ORG, make_account, make_employee, principal_of

PERSONAL = {
    "personal_phone": "+44 7700 900999",
    "home_address": "1 New Road\nLeeds",
    "emergency_contact_name": "Tobias (brother)",
    "emergency_contact_phone": "+44 7700 900456",
}


def work_payload(employee: Employee) -> dict:
    return {
        "name": employee.name,
        "job_title": employee.job_title,
        "department": employee.department,
        "manager_id": str(employee.manager_id),
    }


@pytest.fixture
def new_account(session) -> Account:
    return make_account(session, "Lucia Fernandez")


@pytest.fixture
def create_payload(new_account, manager) -> dict:
    return {
        "account_id": str(new_account.id),
        "name": "Lucia Fernandez",
        "job_title": "Payroll analyst",
        "department": "Finance",
        "manager_id": str(manager.id),
    }


async def test_hr_admin_creates_profile(client_as, hr_admin, create_payload):
    resp = await client_as(hr_admin).post("/employees", json=create_payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Lucia Fernandez" and body["status"] == "active"
    assert body["personal"]["personal_phone"] is None


async def test_non_hr_cannot_create(client_as, employee, create_payload):
    resp = await client_as(principal_of(employee)).post("/employees", json=create_payload)
    assert resp.status_code == 403


async def test_second_profile_refused(client_as, session, hr_admin, create_payload):
    first = await client_as(hr_admin).post("/employees", json=create_payload)
    second = await client_as(hr_admin).post("/employees", json=create_payload)
    assert second.status_code == 409
    assert second.json()["existing_employee_id"] == first.json()["id"]
    # the manager fixture is the only other employee
    assert session.scalar(select(func.count()).select_from(Employee)) == 2


async def test_create_with_blank_name_is_422(client_as, hr_admin, create_payload):
    resp = await client_as(hr_admin).post("/employees", json={**create_payload, "name": "  "})
    assert resp.status_code == 422


@pytest.mark.parametrize("field", ["name", "job_title", "department", "manager_id"])
async def test_hr_changes_one_work_field(
    client_as, hr_admin, employee, other_manager, field
):
    values = {
        "name": "Amara N. Okafor",
        "job_title": "Finance lead",
        "department": "Sales",
        "manager_id": str(other_manager.id),
    }
    resp = await client_as(hr_admin).patch(
        f"/employees/{employee.id}/work", json={**work_payload(employee), field: values[field]}
    )
    assert resp.status_code == 200
    shown = (await client_as(hr_admin).get(f"/employees/{employee.id}")).json()
    assert shown[field] == values[field]


async def test_manager_cannot_be_the_employee(client_as, hr_admin, employee):
    resp = await client_as(hr_admin).patch(
        f"/employees/{employee.id}/work",
        json={**work_payload(employee), "manager_id": str(employee.id)},
    )
    assert resp.status_code == 422


async def test_employee_edits_own_personal_details(client_as, employee):
    resp = await client_as(principal_of(employee)).patch(
        f"/employees/{employee.id}/personal", json=PERSONAL
    )
    assert resp.status_code == 200
    assert resp.json()["personal"]["personal_phone"] == "+44 7700 900999"
    assert resp.json()["personal"]["home_address"] == "1 New Road\nLeeds"


async def test_employee_cannot_edit_work_fields(client_as, session, employee):
    resp = await client_as(principal_of(employee)).patch(
        f"/employees/{employee.id}/work", json={**work_payload(employee), "name": "X"}
    )
    assert resp.status_code == 403
    session.refresh(employee)
    assert employee.name == "Amara Okafor"


async def test_personal_patch_rejects_work_fields(client_as, employee):
    resp = await client_as(principal_of(employee)).patch(
        f"/employees/{employee.id}/personal", json={**PERSONAL, "name": "X"}
    )
    assert resp.status_code == 422


async def test_own_view_capabilities(client_as, employee):
    body = (await client_as(principal_of(employee)).get(f"/employees/{employee.id}")).json()
    assert body["viewer"] == {
        "can_edit_work": False,
        "can_edit_personal": True,
        "can_mark_leaver": False,
    }


async def test_me_returns_own_profile(client_as, employee):
    resp = await client_as(principal_of(employee)).get("/employees/me")
    assert resp.status_code == 200 and resp.json()["id"] == str(employee.id)


async def test_me_without_profile_is_404(client_as, hr_admin):
    assert (await client_as(hr_admin).get("/employees/me")).status_code == 404


async def test_hr_marks_leaver(client_as, employee, hr_admin):
    resp = await client_as(hr_admin).post(f"/employees/{employee.id}/leaver")
    assert resp.status_code == 200 and resp.json()["status"] == "inactive"


async def test_marking_leaver_twice_is_409(client_as, employee, hr_admin):
    await client_as(hr_admin).post(f"/employees/{employee.id}/leaver")
    second = await client_as(hr_admin).post(f"/employees/{employee.id}/leaver")
    assert second.status_code == 409


async def test_non_hr_cannot_mark_leaver(client_as, employee):
    resp = await client_as(principal_of(employee)).post(f"/employees/{employee.id}/leaver")
    assert resp.status_code == 403


async def test_hr_admin_sees_leaver(client_as, leaver, hr_admin):
    resp = await client_as(hr_admin).get(f"/employees/{leaver.id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "inactive"
    assert resp.json()["viewer"]["can_edit_work"] is False


async def test_non_hr_cannot_see_leaver(client_as, leaver, manager, employee):
    for who in (principal_of(manager), principal_of(employee), principal_of(leaver)):
        assert (await client_as(who).get(f"/employees/{leaver.id}")).status_code == 404


async def test_other_organisation_gets_404(client_as, employee):
    outsider = principal_of(employee, hr=True).__class__(
        account_id=uuid.uuid4(), organisation_id=OTHER_ORG, is_hr_admin=True
    )
    assert (await client_as(outsider).get(f"/employees/{employee.id}")).status_code == 404


async def test_hr_sees_personal_block(client_as, employee, hr_admin):
    body = (await client_as(hr_admin).get(f"/employees/{employee.id}")).json()
    assert body["personal"] == {
        "personal_phone": "+44 7700 900123",
        "home_address": "14 Alder Court\nLeeds LS6 2AB",
        "emergency_contact_name": "Tobias Okafor (brother)",
        "emergency_contact_phone": "+44 7700 900456",
    }


async def test_leaver_cannot_edit_personal(client_as, session, leaver):
    resp = await client_as(principal_of(leaver)).patch(
        f"/employees/{leaver.id}/personal", json=PERSONAL
    )
    assert resp.status_code in (403, 404)
    session.refresh(leaver)
    assert leaver.personal_phone == "+44 7700 900123"


async def test_manager_does_not_receive_personal_values(client_as, employee, manager):
    resp = await client_as(principal_of(manager)).get(f"/employees/{employee.id}")
    body = resp.json()
    assert "personal" not in body
    raw = json.dumps(body)
    for secret in (
        employee.personal_phone,
        employee.home_address,
        employee.emergency_contact_name,
        employee.emergency_contact_phone,
    ):
        assert json.dumps(secret)[1:-1] not in raw


async def test_hr_cannot_edit_leaver(client_as, session, leaver, hr_admin):
    w = await client_as(hr_admin).patch(
        f"/employees/{leaver.id}/work", json={**work_payload(leaver), "name": "Changed"}
    )
    p = await client_as(hr_admin).patch(f"/employees/{leaver.id}/personal", json=PERSONAL)
    assert w.status_code in (403, 409) and p.status_code == 403
    session.refresh(leaver)
    assert leaver.name == "Lena Leaver" and leaver.personal_phone == "+44 7700 900123"


async def test_hr_cannot_edit_personal_details(client_as, employee, hr_admin):
    resp = await client_as(hr_admin).patch(f"/employees/{employee.id}/personal", json=PERSONAL)
    assert resp.status_code == 403


async def test_options_lists_accounts_departments_managers(
    client_as, hr_admin, employee, new_account
):
    resp = await client_as(hr_admin).get("/employees/options")
    assert resp.status_code == 200
    body = resp.json()
    by_id = {a["id"]: a for a in body["accounts"]}
    assert by_id[str(new_account.id)]["has_profile"] is False
    assert by_id[str(employee.account_id)]["has_profile"] is True
    assert "Finance" in body["departments"]
    assert str(employee.id) in {m["id"] for m in body["managers"]}


async def test_options_requires_hr(client_as, employee):
    assert (await client_as(principal_of(employee)).get("/employees/options")).status_code == 403


async def test_unauthenticated_default_is_401(session_factory):
    import httpx

    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        assert (await c.get(f"/employees/{uuid.uuid4()}")).status_code == 401


def test_organisation_constant_used():
    assert ORG != OTHER_ORG and make_employee
