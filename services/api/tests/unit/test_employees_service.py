import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.auth import Principal
from app.models import Employee
from app.schemas import EmployeeCreate, EmployeeFullView, EmployeeWorkView
from app.services import employees as svc
from tests.unit.conftest import OTHER_ORG, make_account, principal_of


def test_create_rejects_account_from_other_organisation(session, hr_admin, manager):
    foreign = make_account(session, "Foreign Person", OTHER_ORG)
    data = EmployeeCreate(
        account_id=foreign.id,
        name="Foreign Person",
        job_title="Analyst",
        department="Finance",
        manager_id=manager.id,
    )
    with pytest.raises(svc.InvalidReference):
        svc.create_employee(session, hr_admin, data)


def test_create_rejects_inactive_manager(session, hr_admin, leaver):
    account = make_account(session, "New Person")
    data = EmployeeCreate(
        account_id=account.id,
        name="New Person",
        job_title="Analyst",
        department="Finance",
        manager_id=leaver.id,
    )
    with pytest.raises(svc.InvalidReference):
        svc.create_employee(session, hr_admin, data)


def test_duplicate_reports_existing_id(session, hr_admin, employee, manager):
    data = EmployeeCreate(
        account_id=employee.account_id,
        name="Again",
        job_title="Analyst",
        department="Finance",
        manager_id=manager.id,
    )
    with pytest.raises(svc.DuplicateProfile) as exc:
        svc.create_employee(session, hr_admin, data)
    assert exc.value.existing_employee_id == employee.id


def test_same_account_twice_violates_unique_constraint(session, employee):
    session.add(
        Employee(
            id=uuid.uuid4(),
            organisation_id=employee.organisation_id,
            account_id=employee.account_id,
            name="Dup",
            job_title="x",
            department="y",
        )
    )
    with pytest.raises(IntegrityError):
        session.commit()


def test_to_view_hides_personal_from_manager(session, employee, manager):
    view = svc.to_view(employee, principal_of(manager))
    assert isinstance(view, EmployeeWorkView) and not isinstance(view, EmployeeFullView)
    assert "personal" not in view.model_dump()


def test_to_view_includes_personal_for_owner_and_hr(session, employee, hr_admin):
    assert isinstance(svc.to_view(employee, principal_of(employee)), EmployeeFullView)
    assert isinstance(svc.to_view(employee, hr_admin), EmployeeFullView)


def test_queries_filter_by_organisation(session, employee):
    outsider = Principal(account_id=uuid.uuid4(), organisation_id=OTHER_ORG, is_hr_admin=True)
    with pytest.raises(svc.EmployeeNotFound):
        svc.get_visible_employee(session, outsider, employee.id)
