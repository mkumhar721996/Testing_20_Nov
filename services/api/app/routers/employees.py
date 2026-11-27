from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import Caller, get_caller
from app.db import get_session
from app.models import Employee, EmploymentHistory
from app.repositories import employment as repo
from app.schemas import EmployeeRead, HistoryRead, NamedRef, StructureUpdate
from app.services.employment_structure import (
    Choices,
    EmployeeState,
    StructureError,
    StructureInput,
    apply_structure,
    can_view_history,
)

router = APIRouter()


def _forbidden() -> HTTPException:
    return HTTPException(status.HTTP_403_FORBIDDEN, detail={"code": "forbidden"})


def _require_hr(caller: Caller) -> None:
    if caller.role != "hr":
        raise _forbidden()


def _employee_or_404(session: Session, caller: Caller, employee_id: UUID) -> Employee:
    employee = repo.get_employee(session, caller.organisation_id, employee_id)
    if employee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "employee_not_found"})
    return employee


def _read(session: Session, caller: Caller, employee: Employee) -> EmployeeRead:
    org = caller.organisation_id
    jobs = {j.id: j.name for j in repo.list_jobs(session, org)}
    departments = {d.id: d.name for d in repo.list_departments(session, org)}
    managers = {m.id: m.name for m in repo.list_managers(session, org)}
    viewer = (
        "hr" if caller.role == "hr" else "self" if caller.employee_id == employee.id else "manager"
    )
    return EmployeeRead(
        id=employee.id,
        name=employee.name,
        job=NamedRef(id=employee.job_id, name=jobs[employee.job_id]) if employee.job_id else None,
        department=NamedRef(id=employee.department_id, name=departments[employee.department_id]),
        manager=NamedRef(id=employee.manager_id, name=managers[employee.manager_id]),
        viewer=viewer,
    )


@router.get("/departments", response_model=list[NamedRef])
def list_departments(
    session: Session = Depends(get_session), caller: Caller = Depends(get_caller)
) -> list:
    _require_hr(caller)
    return repo.list_departments(session, caller.organisation_id)


@router.get("/jobs", response_model=list[NamedRef])
def list_jobs(session: Session = Depends(get_session), caller: Caller = Depends(get_caller)) -> list:
    _require_hr(caller)
    return repo.list_jobs(session, caller.organisation_id)


@router.get("/managers", response_model=list[NamedRef])
def list_managers(
    session: Session = Depends(get_session), caller: Caller = Depends(get_caller)
) -> list:
    _require_hr(caller)
    return repo.list_managers(session, caller.organisation_id)


@router.get("/employees/{employee_id}", response_model=EmployeeRead)
def get_employee(
    employee_id: UUID,
    session: Session = Depends(get_session),
    caller: Caller = Depends(get_caller),
) -> EmployeeRead:
    employee = _employee_or_404(session, caller, employee_id)
    is_manager = caller.employee_id is not None and employee.manager_id == caller.employee_id
    if caller.role != "hr" and caller.employee_id != employee.id and not is_manager:
        raise _forbidden()
    return _read(session, caller, employee)


@router.put("/employees/{employee_id}/structure", response_model=EmployeeRead)
def save_structure(
    employee_id: UUID,
    payload: StructureUpdate,
    session: Session = Depends(get_session),
    caller: Caller = Depends(get_caller),
) -> EmployeeRead:
    _require_hr(caller)
    employee = _employee_or_404(session, caller, employee_id)
    org = caller.organisation_id
    choices = Choices(
        jobs={j.id: j.name for j in repo.list_jobs(session, org)},
        departments={d.id: d.name for d in repo.list_departments(session, org)},
        managers={m.id: m.name for m in repo.list_managers(session, org)},
    )
    current = EmployeeState(
        id=employee.id,
        job_id=employee.job_id,
        department_id=employee.department_id,
        manager_id=employee.manager_id,
    )
    try:
        new_state, entries = apply_structure(
            current, StructureInput(**payload.model_dump()), choices, date.today()
        )
    except StructureError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_structure", "errors": exc.errors},
        )
    repo.save_structure(session, org, employee, new_state, entries, caller.user_id)
    return _read(session, caller, employee)


@router.get("/employees/{employee_id}/history", response_model=list[HistoryRead])
def get_history(
    employee_id: UUID,
    session: Session = Depends(get_session),
    caller: Caller = Depends(get_caller),
) -> list[EmploymentHistory]:
    if not can_view_history(caller, employee_id):
        raise _forbidden()
    _employee_or_404(session, caller, employee_id)
    return repo.list_history(session, caller.organisation_id, employee_id)
