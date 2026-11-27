from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Department, Employee, EmploymentHistory, Job
from app.services.employment_structure import EmployeeState, HistoryEntry


def list_departments(session: Session, organisation_id: UUID) -> list[Department]:
    return list(
        session.scalars(
            select(Department)
            .where(Department.organisation_id == organisation_id)
            .order_by(Department.name)
        )
    )


def list_jobs(session: Session, organisation_id: UUID) -> list[Job]:
    return list(
        session.scalars(select(Job).where(Job.organisation_id == organisation_id).order_by(Job.name))
    )


def list_managers(session: Session, organisation_id: UUID) -> list[Employee]:
    return list(
        session.scalars(
            select(Employee).where(Employee.organisation_id == organisation_id).order_by(Employee.name)
        )
    )


def get_employee(session: Session, organisation_id: UUID, employee_id: UUID) -> Employee | None:
    return session.scalar(
        select(Employee).where(Employee.id == employee_id, Employee.organisation_id == organisation_id)
    )


def list_history(
    session: Session, organisation_id: UUID, employee_id: UUID
) -> list[EmploymentHistory]:
    return list(
        session.scalars(
            select(EmploymentHistory)
            .where(
                EmploymentHistory.organisation_id == organisation_id,
                EmploymentHistory.employee_id == employee_id,
            )
            .order_by(EmploymentHistory.effective_date.desc(), EmploymentHistory.recorded_at.desc())
        )
    )


def save_structure(
    session: Session,
    organisation_id: UUID,
    employee: Employee,
    new_state: EmployeeState,
    entries: list[HistoryEntry],
    recorded_by: UUID,
) -> None:
    """Update the employee and insert its history rows in one transaction."""
    try:
        employee.job_id = new_state.job_id
        employee.department_id = new_state.department_id
        employee.manager_id = new_state.manager_id
        now = datetime.now(UTC)
        session.add_all(
            EmploymentHistory(
                id=uuid4(),
                organisation_id=organisation_id,
                employee_id=employee.id,
                field=e.field,
                from_id=e.from_id,
                to_id=e.to_id,
                from_name=e.from_name,
                to_name=e.to_name,
                effective_date=e.effective_date,
                recorded_at=now,
                recorded_by=recorded_by,
            )
            for e in entries
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
