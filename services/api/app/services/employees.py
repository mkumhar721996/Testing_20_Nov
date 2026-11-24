"""Employee profile rules: who may see and change what. No HTTP types in here."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import Principal
from app.models import Account, Employee
from app.schemas import (
    AccountOption,
    EmployeeCreate,
    EmployeeFullView,
    EmployeeOptions,
    EmployeeWorkView,
    ManagerOption,
    PersonalDetails,
    PersonalDetailsUpdate,
    Viewer,
    WorkDetailsUpdate,
)

ACTIVE = "active"
INACTIVE = "inactive"


class EmployeeNotFound(Exception):
    pass


class NotPermitted(Exception):
    pass


class DuplicateProfile(Exception):
    def __init__(self, existing_employee_id: UUID):
        super().__init__("This employee already has a profile.")
        self.existing_employee_id = existing_employee_id


class InvalidReference(Exception):
    pass


class AlreadyInactive(Exception):
    pass


def _is_self(employee: Employee, principal: Principal) -> bool:
    return principal.account_id == employee.account_id


def capabilities(employee: Employee, principal: Principal) -> Viewer:
    """The only place the edit rules are written; the views and the checks below use it."""
    active = employee.status == ACTIVE
    return Viewer(
        can_edit_work=principal.is_hr_admin and active,
        can_edit_personal=_is_self(employee, principal) and active,
        can_mark_leaver=principal.is_hr_admin and active,
    )


def _can_see_personal(employee: Employee, principal: Principal) -> bool:
    return principal.is_hr_admin or _is_self(employee, principal)


def _require_hr(principal: Principal) -> None:
    if not principal.is_hr_admin:
        raise NotPermitted("Only HR admins can do this.")


def get_visible_employee(session: Session, principal: Principal, employee_id: UUID) -> Employee:
    employee = session.scalar(
        select(Employee).where(
            Employee.id == employee_id, Employee.organisation_id == principal.organisation_id
        )
    )
    if employee is None or (employee.status != ACTIVE and not principal.is_hr_admin):
        raise EmployeeNotFound()
    return employee


def get_own_employee(session: Session, principal: Principal) -> Employee:
    employee = session.scalar(
        select(Employee).where(
            Employee.account_id == principal.account_id,
            Employee.organisation_id == principal.organisation_id,
        )
    )
    if employee is None or (employee.status != ACTIVE and not principal.is_hr_admin):
        raise EmployeeNotFound()
    return employee


def to_view(employee: Employee, principal: Principal) -> EmployeeWorkView | EmployeeFullView:
    fields = dict(
        id=employee.id,
        name=employee.name,
        job_title=employee.job_title,
        department=employee.department,
        manager_id=employee.manager_id,
        manager_name=employee.manager.name if employee.manager else None,
        work_email=employee.account.email,
        status=employee.status,
        viewer=capabilities(employee, principal),
    )
    if not _can_see_personal(employee, principal):
        return EmployeeWorkView(**fields)
    return EmployeeFullView(
        **fields,
        personal=PersonalDetails(
            personal_phone=employee.personal_phone,
            home_address=employee.home_address,
            emergency_contact_name=employee.emergency_contact_name,
            emergency_contact_phone=employee.emergency_contact_phone,
        ),
    )


def _active_manager(session: Session, principal: Principal, manager_id: UUID) -> Employee:
    manager = session.scalar(
        select(Employee).where(
            Employee.id == manager_id,
            Employee.organisation_id == principal.organisation_id,
            Employee.status == ACTIVE,
        )
    )
    if manager is None:
        raise InvalidReference("Choose an active employee as manager.")
    return manager


def create_employee(session: Session, principal: Principal, data: EmployeeCreate) -> Employee:
    _require_hr(principal)
    account = session.scalar(
        select(Account).where(
            Account.id == data.account_id, Account.organisation_id == principal.organisation_id
        )
    )
    if account is None:
        raise InvalidReference("Choose an employee from the list.")
    _active_manager(session, principal, data.manager_id)

    def existing_id() -> UUID | None:
        return session.scalar(
            select(Employee.id).where(
                Employee.organisation_id == principal.organisation_id,
                Employee.account_id == account.id,
            )
        )

    if (found := existing_id()) is not None:
        raise DuplicateProfile(found)
    employee = Employee(
        organisation_id=principal.organisation_id,
        account_id=account.id,
        name=data.name,
        job_title=data.job_title,
        department=data.department,
        manager_id=data.manager_id,
    )
    session.add(employee)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        if (found := existing_id()) is None:
            raise
        raise DuplicateProfile(found) from None
    return employee


def update_work_details(
    session: Session, principal: Principal, employee_id: UUID, data: WorkDetailsUpdate
) -> Employee:
    employee = get_visible_employee(session, principal, employee_id)
    _require_hr(principal)
    if employee.status != ACTIVE:
        raise AlreadyInactive("This record is inactive and read-only.")
    if data.manager_id == employee.id:
        raise InvalidReference("An employee cannot be their own manager.")
    _active_manager(session, principal, data.manager_id)
    employee.name = data.name
    employee.job_title = data.job_title
    employee.department = data.department
    employee.manager_id = data.manager_id
    session.commit()
    return employee


def update_personal_details(
    session: Session, principal: Principal, employee_id: UUID, data: PersonalDetailsUpdate
) -> Employee:
    employee = get_visible_employee(session, principal, employee_id)
    if not _is_self(employee, principal):
        raise NotPermitted("Only the employee can change their own contact details.")
    if employee.status != ACTIVE:
        raise AlreadyInactive("This record is inactive and read-only.")
    employee.personal_phone = data.personal_phone
    employee.home_address = data.home_address
    employee.emergency_contact_name = data.emergency_contact_name
    employee.emergency_contact_phone = data.emergency_contact_phone
    session.commit()
    return employee


def mark_leaver(session: Session, principal: Principal, employee_id: UUID) -> Employee:
    _require_hr(principal)
    employee = get_visible_employee(session, principal, employee_id)
    if employee.status != ACTIVE:
        raise AlreadyInactive("This employee is already marked as a leaver.")
    employee.status = INACTIVE
    session.commit()
    return employee


def get_options(session: Session, principal: Principal) -> EmployeeOptions:
    _require_hr(principal)
    org = principal.organisation_id
    profiled = set(session.scalars(select(Employee.account_id).where(Employee.organisation_id == org)))
    accounts = session.scalars(
        select(Account).where(Account.organisation_id == org).order_by(Account.display_name)
    )
    active = session.scalars(
        select(Employee)
        .where(Employee.organisation_id == org, Employee.status == ACTIVE)
        .order_by(Employee.name)
    ).all()
    return EmployeeOptions(
        accounts=[
            AccountOption(
                id=a.id, name=a.display_name, email=a.email, has_profile=a.id in profiled
            )
            for a in accounts
        ],
        departments=sorted({e.department for e in active}),
        managers=[ManagerOption(id=e.id, name=e.name) for e in active],
    )
