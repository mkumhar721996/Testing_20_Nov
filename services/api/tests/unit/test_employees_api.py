from datetime import UTC, date, datetime
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import Caller, get_caller
from app.main import app
from app.models import Base, Department, Employee, EmploymentHistory, Job
from app.repositories import employment as repo
from app.services.employment_structure import EmployeeState, HistoryEntry
from tests.unit.conftest import ORG, OTHER_ORG

J_ACCT, J_SEN = uuid4(), uuid4()
D_FIN, D_ENG = uuid4(), uuid4()
M_HANNAH, M_DANIEL, EMP, OTHER_EMP = uuid4(), uuid4(), uuid4(), uuid4()


@pytest.fixture
def seeded(session):
    session.add_all(
        [
            Job(id=J_ACCT, organisation_id=ORG, name="Accountant"),
            Job(id=J_SEN, organisation_id=ORG, name="Senior accountant"),
            Department(id=D_FIN, organisation_id=ORG, name="Finance"),
            Department(id=D_ENG, organisation_id=ORG, name="Engineering"),
        ]
    )
    session.flush()
    # SQLite does not enforce FKs here; the self-referencing manager rows are order-safe.
    for id_, name, mgr in [
        (M_HANNAH, "Hannah Brooks", M_HANNAH),
        (M_DANIEL, "Daniel Whitfield", M_HANNAH),
        (EMP, "Priya Nair", M_HANNAH),
        (OTHER_EMP, "Sam Other", M_HANNAH),
    ]:
        session.add(
            Employee(
                id=id_,
                organisation_id=ORG,
                name=name,
                work_email=f"{name}@example.com",
                job_id=J_ACCT if id_ == EMP else None,
                department_id=D_FIN,
                manager_id=mgr,
            )
        )
    session.commit()


def as_caller(role, employee_id=None, org=ORG):
    app.dependency_overrides[get_caller] = lambda: Caller(uuid4(), org, role, employee_id)


@pytest.fixture
def hr():
    as_caller("hr")


def payload(job=J_ACCT, dept=D_FIN, mgr=M_HANNAH, eff="2024-03-01"):
    return {
        "job_id": str(job) if job else None,
        "department_id": str(dept) if dept else None,
        "manager_id": str(mgr) if mgr else None,
        "effective_date": eff,
    }


async def test_saving_a_job_shows_it_as_current(client, seeded, hr):
    r = await client.put(f"/employees/{EMP}/structure", json=payload(job=J_SEN))
    assert r.status_code == 200
    body = (await client.get(f"/employees/{EMP}")).json()
    assert body["job"]["name"] == "Senior accountant"
    assert body["viewer"] == "hr"


async def test_missing_department_is_422_and_unchanged(client, seeded, hr):
    r = await client.put(f"/employees/{EMP}/structure", json=payload(dept=None, job=J_SEN))
    assert r.status_code == 422
    assert "department_id" in r.json()["detail"]["errors"]
    body = (await client.get(f"/employees/{EMP}")).json()
    assert body["department"]["name"] == "Finance" and body["job"]["name"] == "Accountant"


async def test_missing_manager_is_422_and_unchanged(client, seeded, hr):
    r = await client.put(f"/employees/{EMP}/structure", json=payload(mgr=None, job=J_SEN))
    assert r.status_code == 422
    assert "manager_id" in r.json()["detail"]["errors"]
    assert (await client.get(f"/employees/{EMP}")).json()["manager"]["name"] == "Hannah Brooks"


async def test_changed_department_is_a_single_object(client, seeded, hr):
    resp = await client.put(f"/employees/{EMP}/structure", json=payload(dept=D_ENG))
    assert resp.json()["department"] == {"id": str(D_ENG), "name": "Engineering"}


async def test_changed_manager_is_a_single_object(client, seeded, hr):
    resp = await client.put(f"/employees/{EMP}/structure", json=payload(mgr=M_DANIEL))
    assert resp.json()["manager"] == {"id": str(M_DANIEL), "name": "Daniel Whitfield"}


async def test_departments_are_flat(client, seeded, hr):
    body = (await client.get("/departments")).json()
    assert {d["name"] for d in body} == {"Finance", "Engineering"}
    assert all(set(d) == {"id", "name"} for d in body)
    assert len((await client.get("/jobs")).json()) == 2
    assert len((await client.get("/managers")).json()) == 4


async def test_choices_are_hr_only(client, seeded):
    as_caller("manager", M_HANNAH)
    for path in ("/departments", "/jobs", "/managers"):
        assert (await client.get(path)).status_code == 403


CHANGES = {
    "job": dict(job=J_SEN),
    "department": dict(dept=D_ENG),
    "manager": dict(mgr=M_DANIEL),
}


@pytest.mark.parametrize("field", CHANGES)
async def test_hr_sees_each_recorded_change_with_its_date(client, seeded, hr, field):
    await client.put(f"/employees/{EMP}/structure", json=payload(**CHANGES[field]))
    r = await client.get(f"/employees/{EMP}/history")
    assert r.status_code == 200
    assert [(h["field"], h["effective_date"]) for h in r.json()] == [(field, "2024-03-01")]


@pytest.mark.parametrize("field", CHANGES)
async def test_employee_sees_own_history(client, seeded, field):
    as_caller("hr")
    await client.put(f"/employees/{EMP}/structure", json=payload(**CHANGES[field]))
    as_caller("employee", EMP)
    r = await client.get(f"/employees/{EMP}/history")
    assert r.status_code == 200 and len(r.json()) == 1
    assert r.json()[0]["effective_date"] == "2024-03-01"
    assert (await client.get(f"/employees/{EMP}")).json()["viewer"] == "self"
    as_caller("employee", OTHER_EMP)
    assert (await client.get(f"/employees/{EMP}/history")).status_code == 403


@pytest.mark.parametrize("field", CHANGES)
async def test_manager_cannot_see_history(client, seeded, field):
    as_caller("hr")
    await client.put(f"/employees/{EMP}/structure", json=payload(**CHANGES[field]))
    as_caller("manager", M_HANNAH)
    r = await client.get(f"/employees/{EMP}/history")
    assert r.status_code == 403
    assert "effective_date" not in r.text
    as_caller("manager", M_DANIEL if field == "manager" else M_HANNAH)  # the current manager
    assert (await client.get(f"/employees/{EMP}/history")).status_code == 403
    profile = await client.get(f"/employees/{EMP}")
    assert profile.status_code == 200 and profile.json()["viewer"] == "manager"


async def test_manager_cannot_save_structure(client, seeded):
    as_caller("manager", M_HANNAH)
    r = await client.put(f"/employees/{EMP}/structure", json=payload(job=J_SEN))
    assert r.status_code == 403


async def test_history_is_newest_first(client, seeded, hr, session):
    for eff, field in [("2023-01-01", "job"), ("2024-05-01", "manager"), ("2024-01-01", "department")]:
        session.add(
            EmploymentHistory(
                id=uuid4(), organisation_id=ORG, employee_id=EMP, field=field, from_id=None,
                to_id=uuid4(), from_name=None, to_name="x", effective_date=date.fromisoformat(eff),
                recorded_at=datetime.now(UTC), recorded_by=uuid4(),
            )
        )
    session.commit()
    dates = [h["effective_date"] for h in (await client.get(f"/employees/{EMP}/history")).json()]
    assert dates == ["2024-05-01", "2024-01-01", "2023-01-01"]


async def test_other_organisation_gets_404(client, seeded):
    as_caller("hr", org=OTHER_ORG)
    assert (await client.get(f"/employees/{EMP}")).status_code == 404
    assert (await client.get(f"/employees/{EMP}/history")).status_code == 404
    assert (await client.put(f"/employees/{EMP}/structure", json=payload())).status_code == 404


async def test_unconfigured_caller_is_401(client, seeded):
    app.dependency_overrides.pop(get_caller, None)
    assert (await client.get(f"/employees/{EMP}")).status_code == 401
    assert (await client.get(f"/employees/{EMP}/history")).status_code == 401


def test_department_has_no_parent_column():
    assert "parent_id" not in Department.__table__.c


def test_save_commits_employee_and_history_together(session, seeded):
    emp = repo.get_employee(session, ORG, EMP)
    state = EmployeeState(EMP, J_ACCT, D_ENG, M_HANNAH)
    entry = HistoryEntry("department", D_FIN, D_ENG, "Finance", "Engineering", date(2024, 3, 1))
    repo.save_structure(session, ORG, emp, state, [entry], uuid4())
    assert repo.get_employee(session, ORG, EMP).department_id == D_ENG
    assert len(repo.list_history(session, ORG, EMP)) == 1


def test_failed_history_insert_rolls_back_the_employee(session, seeded):
    emp = repo.get_employee(session, ORG, EMP)
    state = EmployeeState(EMP, J_ACCT, D_ENG, M_HANNAH)
    bad = HistoryEntry("bogus", D_FIN, D_ENG, "Finance", "Engineering", date(2024, 3, 1))  # type: ignore[arg-type]
    with pytest.raises(Exception):
        repo.save_structure(session, ORG, emp, state, [bad], uuid4())
    assert repo.get_employee(session, ORG, EMP).department_id == D_FIN
    assert repo.list_history(session, ORG, EMP) == []
