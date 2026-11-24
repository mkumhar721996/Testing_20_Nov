import json
import uuid

import pytest
from sqlalchemy import func, select

from app.auth import Principal
from app.models import Employee
from tests.unit.conftest import OTHER_ORG, as_employee

PERSONAL = {
    "personal_phone": "+44 7700 900999",
    "home_address": "1 New Road\nLeeds",
    "emergency_contact_name": "Tobias (brother)",
    "emergency_contact_phone": "+44 7700 900456",
}


def create_payload(account, manager):
    return {
        "account_id": str(account.id),
        "name": "Lucia Fernandez",
        "job_title": "Payroll analyst",
        "department": "Finance",
        "manager_id": str(manager.id),
    }


def work_payload(employee):
    return {
        "name": employee.name,
        "job_title": employee.job_title,
        "department": employee.department,
        "manager_id": str(employee.manager_id),
    }


def manager_principal(manager) -> Principal:
    return as_employee(manager)


# AC1
async def test_hr_admin_creates_profile(client_as, hr_admin, new_account, manager):
    resp = await client_as(hr_admin).post("/employees", json=create_payload(new_account, manager))
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Lucia Fernandez" and body["status"] == "active"
    assert body["personal"]["personal_phone"] is None


async def test_non_hr_cannot_create(client_as, new_account, manager, employee):
    resp = await client_as(as_employee(employee)).post(
        "/employees", json=create_payload(new_account, manager)
    )
    assert resp.status_code == 403


# AC2
async def test_second_profile_refused(client_as, hr_admin, new_account, manager, session):
    payload = create_payload(new_account, manager)
    client = client_as(hr_admin)
    first = await client.post("/employees", json=payload)
    second = await client.post("/employees", json=payload)
    assert second.status_code == 409
    assert second.json()["existing_employee_id"] == first.json()["id"]
    # the manager fixture is one employee, plus the single created profile
    assert session.scalar(select(func.count()).select_from(Employee)) == 2


# AC3
@pytest.mark.parametrize("field", ["name", "job_title", "department", "manager_id"])
async def test_hr_changes_one_work_field(client_as, hr_admin, employee, other_manager, field):
    values = {
        "name": "Amara N. Okafor",
        "job_title": "Finance lead",
        "department": "Sales",
        "manager_id": str(other_manager.id),
    }
    body = {**work_payload(employee), field: values[field]}
    client = client_as(hr_admin)
    resp = await client.patch(f"/employees/{employee.id}/work", json=body)
    assert resp.status_code == 200
    shown = (await client.get(f"/employees/{employee.id}")).json()
    assert shown[field] == values[field]


# AC4
async def test_employee_edits_own_personal_details(client_as, employee):
    resp = await client_as(as_employee(employee)).patch(
        f"/employees/{employee.id}/personal", json=PERSONAL
    )
    assert resp.status_code == 200
    assert resp.json()["personal"]["personal_phone"] == "+44 7700 900999"
    assert resp.json()["personal"]["home_address"] == "1 New Road\nLeeds"


# AC5
async def test_employee_cannot_edit_work_details(client_as, employee, session):
    resp = await client_as(as_employee(employee)).patch(
        f"/employees/{employee.id}/work", json={**work_payload(employee), "name": "X"}
    )
    assert resp.status_code == 403
    session.refresh(employee)
    assert employee.name == "Amara Okafor"


async def test_personal_endpoint_rejects_work_fields(client_as, employee):
    resp = await client_as(as_employee(employee)).patch(
        f"/employees/{employee.id}/personal", json={**PERSONAL, "name": "X"}
    )
    assert resp.status_code == 422


async def test_own_view_capabilities(client_as, employee):
    resp = await client_as(as_employee(employee)).get(f"/employees/{employee.id}")
    assert resp.json()["viewer"] == {
        "can_edit_work": False,
        "can_edit_personal": True,
        "can_mark_leaver": False,
    }


async def test_me_returns_own_profile(client_as, employee):
    resp = await client_as(as_employee(employee)).get("/employees/me")
    assert resp.status_code == 200 and resp.json()["id"] == str(employee.id)


# AC6
async def test_hr_marks_leaver(client_as, hr_admin, employee):
    resp = await client_as(hr_admin).post(f"/employees/{employee.id}/leaver")
    assert resp.status_code == 200 and resp.json()["status"] == "inactive"


async def test_marking_leaver_twice_is_409(client_as, hr_admin, employee):
    client = client_as(hr_admin)
    await client.post(f"/employees/{employee.id}/leaver")
    assert (await client.post(f"/employees/{employee.id}/leaver")).status_code == 409


async def test_non_hr_cannot_mark_leaver(client_as, employee, session):
    resp = await client_as(as_employee(employee)).post(f"/employees/{employee.id}/leaver")
    assert resp.status_code == 403
    session.refresh(employee)
    assert employee.status == "active"


# AC7
async def test_hr_admin_sees_leaver(client_as, hr_admin, leaver):
    resp = await client_as(hr_admin).get(f"/employees/{leaver.id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "inactive"


# AC8
async def test_non_hr_cannot_see_leaver(client_as, manager, leaver):
    for who in (manager_principal(manager), as_employee(leaver)):
        resp = await client_as(who).get(f"/employees/{leaver.id}")
        assert resp.status_code == 404


async def test_other_organisation_hr_cannot_see_active_record(client_as, employee):
    other_hr = Principal(account_id=uuid.uuid4(), organisation_id=OTHER_ORG, is_hr_admin=True)
    assert (await client_as(other_hr).get(f"/employees/{employee.id}")).status_code == 404


# AC9
async def test_manager_does_not_receive_personal_fields(client_as, manager, employee):
    resp = await client_as(manager_principal(manager)).get(f"/employees/{employee.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert "personal" not in body
    raw = json.dumps(body)
    for value in ("+44 7700 900123", "Alder Court", "Tobias"):
        assert value not in raw


# AC10
async def test_hr_sees_personal_fields(client_as, hr_admin, employee):
    body = (await client_as(hr_admin).get(f"/employees/{employee.id}")).json()
    assert body["personal"] == {
        "personal_phone": "+44 7700 900123",
        "home_address": "14 Alder Court\nLeeds LS6 2AB",
        "emergency_contact_name": "Tobias Okafor (brother)",
        "emergency_contact_phone": "+44 7700 900456",
    }


async def test_hr_cannot_edit_personal_details(client_as, hr_admin, employee):
    resp = await client_as(hr_admin).patch(f"/employees/{employee.id}/personal", json=PERSONAL)
    assert resp.status_code == 403


# AC11
async def test_leaver_cannot_edit_personal(client_as, leaver, session):
    resp = await client_as(as_employee(leaver)).patch(
        f"/employees/{leaver.id}/personal", json=PERSONAL
    )
    assert resp.status_code in (403, 404)
    session.refresh(leaver)
    assert leaver.personal_phone == "+44 7700 900123"


async def test_options_for_hr(client_as, hr_admin, employee, new_account):
    body = (await client_as(hr_admin).get("/employees/options")).json()
    by_email = {a["email"]: a for a in body["accounts"]}
    assert by_email[new_account.email]["has_profile"] is False
    assert by_email["amara.okafor@comp.example"]["has_profile"] is True
    assert "Finance" in body["departments"]
    assert str(employee.id) in {m["id"] for m in body["managers"]}


async def test_options_forbidden_for_non_hr(client_as, employee):
    assert (await client_as(as_employee(employee)).get("/employees/options")).status_code == 403
