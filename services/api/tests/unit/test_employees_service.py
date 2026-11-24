import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.auth import Principal
from app.models import Employee
from app.schemas import EmployeeCreate, EmployeeFullView, EmployeeWorkView
from app.services import employees as svc
from tests.unit.conftest import OTHER_ORG, as_employee, make_account


def test_create_rejects_account_from_other_organisation(session, hr_admin, manager):
    foreign = make_account(session, "Foreign Person", org=OTHER_ORG)
    data = EmployeeCreate(
        account_id=foreign.id,
        name="Foreign Person",
        job_title="Analyst",
        department="Finance",
        manager_id=manager.id,
    )
    with pytest.raises(svc.InvalidReference):
        svc.create_employee(session, hr_admin, data)


def test_create_rejects_inactive_manager(session, hr_admin, leaver, new_account):
    data = EmployeeCreate(
        account_id=new_account.id,
        name="Lucia",
        job_title="Analyst",
        department="Finance",
        manager_id=leaver.id,
    )
    with pytest.raises(svc.InvalidReference):
        svc.create_employee(session, hr_admin, data)


def test_duplicate_profile_reports_existing_id(session, hr_admin, employee, manager):
    data = EmployeeCreate(
        account_id=employee.account_id,
        name="Again",
        job_title="Analyst",
        department="Finance",
        manager_id=manager.id,
    )
    with pytest.raises(svc.DuplicateProfile) as err:
        svc.create_employee(session, hr_admin, data)
    assert err.value.existing_employee_id == employee.id


def test_to_view_hides_personal_from_non_owner(session, employee, manager):
    view = svc.to_view(employee, as_employee(manager))
    assert isinstance(view, EmployeeWorkView)
    assert not hasattr(view, "personal")


def test_to_view_includes_personal_for_owner_and_hr(employee, hr_admin):
    assert isinstance(svc.to_view(employee, as_employee(employee)), EmployeeFullView)
    assert isinstance(svc.to_view(employee, hr_admin), EmployeeFullView)


def test_other_organisation_behaves_as_not_found(session, employee):
    other = Principal(account_id=uuid.uuid4(), organisation_id=OTHER_ORG, is_hr_admin=True)
    with pytest.raises(svc.EmployeeNotFound):
        svc.get_visible_employee(session, other, employee.id)


def test_manager_cannot_be_the_employee(session, hr_admin, employee):
    from app.schemas import WorkDetailsUpdate

    data = WorkDetailsUpdate(
        name="A", job_title="B", department="C", manager_id=employee.id
    )
    with pytest.raises(svc.InvalidReference):
        svc.update_work_details(session, hr_admin, employee.id, data)


def test_hr_cannot_edit_work_of_leaver(session, hr_admin, leaver, manager):
    from app.schemas import WorkDetailsUpdate

    data = WorkDetailsUpdate(name="A", job_title="B", department="C", manager_id=manager.id)
    with pytest.raises(svc.AlreadyInactive):
        svc.update_work_details(session, hr_admin, leaver.id, data)


# database backstop for AC2
def test_unique_account_per_organisation(session, employee):
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
