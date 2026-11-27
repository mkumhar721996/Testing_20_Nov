"""Employee profile rules: who may see and change what.

Session-based and free of HTTP types so the privacy rules live in one testable place.
Every query is filtered by the caller's organisation (ADR-0009).
"""

from dataclasses import dataclass
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
    PersonalBlock,
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
    def __init__(self, existing_employee_id: UUID) -> None:
        super().__init__("This employee already has a profile.")
        self.existing_employee_id = existing_employee_id


class InvalidReference(Exception):
    pass


class AlreadyInactive(Exception):
    pass


@dataclass(frozen=True)
class Capabilities:
    can_see_personal: bool
    can_edit_work: bool
    can_edit_personal: bool
    can_mark_leaver: bool


def capabilities(employee: Employee, principal: Principal) -> Capabilities:
    """The only place the visibility and edit rules are written."""
    is_active = employee.status == ACTIVE
    is_self = principal.account_id == employee.account_id
    return Capabilities(
        can_see_personal=principal.is_hr_admin or is_self,
        can_edit_work=principal.is_hr_admin and is_active,
        can_edit_personal=is_self and is_active,
        can_mark_leaver=principal.is_hr_admin and is_active,
    )


def _find(session: Session, principal: Principal, employee_id: UUID) -> Employee | None:
    return session.scalar(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.organisation_id == principal.organisation_id,
        )
    )


def _require_hr(principal: Principal) -> None:
    if not principal.is_hr_admin:
        raise NotPermitted("Only HR admins can do this.")


def get_visible_employee(session: Session, principal: Principal, employee_id: UUID) -> Employee:
    employee = _find(session, principal, employee_id)
    if employee is None or (employee.status != ACTIVE and not principal.is_hr_admin):
        raise EmployeeNotFound
    return employee


def get_own_employee(session: Session, principal: Principal) -> Employee:
    employee = session.scalar(
        select(Employee).where(
            Employee.account_id == principal.account_id,
            Employee.organisation_id == principal.organisation_id,
        )
    )
    if employee is None or (employee.status != ACTIVE and not principal.is_hr_admin):
        raise EmployeeNotFound
    return employee


def _active_manager(session: Session, principal: Principal, manager_id: UUID) -> Employee:
    manager = _find(session, principal, manager_id)
    if manager is None or manager.status != ACTIVE:
        raise InvalidReference("Choose an active manager from your organisation.")
    return manager


def create_employee(session: Session, principal: Principal, data: EmployeeCreate) -> Employee:
    _require_hr(principal)
    account = session.scalar(
        select(Account).where(
            Account.id == data.account_id,
            Account.organisation_id == principal.organisation_id,
        )
    )
    if account is None:
        raise InvalidReference("Choose an employee from your organisation.")

    def existing_id() -> UUID | None:
        return session.scalar(
            select(Employee.id).where(
                Employee.organisation_id == principal.organisation_id,
                Employee.account_id == account.id,
            )
        )

    if (found := existing_id()) is not None:
        raise DuplicateProfile(found)
    _active_manager(session, principal, data.manager_id)

    employee = Employee(
        organisation_id=principal.organisation_id,
        account_id=account.id,
        name=data.name,
        job_title=data.job_title,
        department=data.department,
        manager_id=data.manager_id,
        status=ACTIVE,
    )
    session.add(employee)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        found = existing_id()
        if found is None:
            raise
        raise DuplicateProfile(found) from None
    return employee


def update_work_details(
    session: Session, principal: Principal, employee_id: UUID, data: WorkDetailsUpdate
) -> Employee:
    employee = get_visible_employee(session, principal, employee_id)
    if not capabilities(employee, principal).can_edit_work:
        raise NotPermitted("Work details are changed by HR admins on active records.")
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
    if not capabilities(employee, principal).can_edit_personal:
        raise NotPermitted("Only the employee can change their contact details.")
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


def to_view(employee: Employee, principal: Principal) -> EmployeeWorkView | EmployeeFullView:
    caps = capabilities(employee, principal)
    fields = dict(
        id=employee.id,
        account_id=employee.account_id,
        name=employee.name,
        job_title=employee.job_title,
        department=employee.department,
        manager_id=employee.manager_id,
        manager_name=employee.manager.name if employee.manager else None,
        work_email=employee.account.email,
        status=employee.status,
        viewer=Viewer(
            can_edit_work=caps.can_edit_work,
            can_edit_personal=caps.can_edit_personal,
            can_mark_leaver=caps.can_mark_leaver,
        ),
    )
    if not caps.can_see_personal:
        return EmployeeWorkView(**fields)
    return EmployeeFullView(
        **fields,
        personal=PersonalBlock(
            personal_phone=employee.personal_phone,
            home_address=employee.home_address,
            emergency_contact_name=employee.emergency_contact_name,
            emergency_contact_phone=employee.emergency_contact_phone,
        ),
    )


def get_options(session: Session, principal: Principal) -> EmployeeOptions:
    _require_hr(principal)
    org = principal.organisation_id
    accounts = session.scalars(
        select(Account).where(Account.organisation_id == org).order_by(Account.display_name)
    ).all()
    with_profile = set(
        session.scalars(select(Employee.account_id).where(Employee.organisation_id == org))
    )
    departments = session.scalars(
        select(Employee.department)
        .where(Employee.organisation_id == org)
        .distinct()
        .order_by(Employee.department)
    ).all()
    managers = session.scalars(
        select(Employee)
        .where(Employee.organisation_id == org, Employee.status == ACTIVE)
        .order_by(Employee.name)
    ).all()
    return EmployeeOptions(
        accounts=[
            AccountOption(
                id=a.id, name=a.display_name, email=a.email, has_profile=a.id in with_profile
            )
            for a in accounts
        ],
        departments=list(departments),
        managers=[ManagerOption(id=m.id, name=m.name) for m in managers],
    )
