from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.auth import Principal, get_principal
from app.db import get_session
from app.schemas import (
    EmployeeCreate,
    EmployeeOptions,
    PersonalDetailsUpdate,
    WorkDetailsUpdate,
)
from app.services import employees as svc

router = APIRouter(prefix="/employees", tags=["employees"])

SessionDep = Annotated[Session, Depends(get_session)]
PrincipalDep = Annotated[Principal, Depends(get_principal)]


def _error(status_code: int, detail: str, **extra: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail, **extra})


def _handle(func, *args):
    """Run a service call and answer with the view, or the mapped HTTP error."""
    try:
        return func(*args)
    except svc.EmployeeNotFound:
        return _error(status.HTTP_404_NOT_FOUND, "This profile isn't available.")
    except svc.NotPermitted as err:
        return _error(status.HTTP_403_FORBIDDEN, str(err))
    except svc.DuplicateProfile as err:
        return _error(
            status.HTTP_409_CONFLICT, str(err), existing_employee_id=str(err.existing_employee_id)
        )
    except svc.InvalidReference as err:
        return _error(status.HTTP_422_UNPROCESSABLE_ENTITY, str(err))
    except svc.AlreadyInactive as err:
        return _error(status.HTTP_409_CONFLICT, str(err))


def _view(principal: Principal, call, *args):
    result = _handle(call, *args)
    if isinstance(result, JSONResponse):
        return result
    return svc.to_view(result, principal)


# response_model=None: the view is returned as-is so `personal` is genuinely absent for others.
@router.post("", status_code=status.HTTP_201_CREATED, response_model=None)
def create_employee(data: EmployeeCreate, session: SessionDep, principal: PrincipalDep):
    return _view(principal, svc.create_employee, session, principal, data)


@router.get("/me", response_model=None)
def get_me(session: SessionDep, principal: PrincipalDep):
    return _view(principal, svc.get_own_employee, session, principal)


@router.get("/options")
def get_options(session: SessionDep, principal: PrincipalDep) -> EmployeeOptions:
    result = _handle(svc.get_options, session, principal)
    return result


@router.get("/{employee_id}", response_model=None)
def get_employee(employee_id: UUID, session: SessionDep, principal: PrincipalDep):
    return _view(principal, svc.get_visible_employee, session, principal, employee_id)


@router.patch("/{employee_id}/work", response_model=None)
def update_work(
    employee_id: UUID, data: WorkDetailsUpdate, session: SessionDep, principal: PrincipalDep
):
    return _view(principal, svc.update_work_details, session, principal, employee_id, data)


@router.patch("/{employee_id}/personal", response_model=None)
def update_personal(
    employee_id: UUID, data: PersonalDetailsUpdate, session: SessionDep, principal: PrincipalDep
):
    return _view(principal, svc.update_personal_details, session, principal, employee_id, data)


@router.post("/{employee_id}/leaver", response_model=None)
def mark_leaver(employee_id: UUID, session: SessionDep, principal: PrincipalDep):
    return _view(principal, svc.mark_leaver, session, principal, employee_id)
