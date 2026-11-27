from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.auth import Principal, get_principal
from app.db import get_session
from app.schemas import (
    EmployeeCreate,
    EmployeeFullView,
    EmployeeOptions,
    EmployeeWorkView,
    PersonalDetailsUpdate,
    WorkDetailsUpdate,
)
from app.services import employees as svc

router = APIRouter(prefix="/employees", tags=["employees"])

SessionDep = Annotated[Session, Depends(get_session)]
PrincipalDep = Annotated[Principal, Depends(get_principal)]


@contextmanager
def _http_errors() -> Iterator[None]:
    try:
        yield
    except svc.EmployeeNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This profile isn't available.") from None
    except svc.NotPermitted as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from None
    except svc.InvalidReference as exc:
        raise HTTPException(422, str(exc)) from None
    except svc.AlreadyInactive as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from None


@router.post("", status_code=status.HTTP_201_CREATED, response_model=None)
def create_profile(
    data: EmployeeCreate, session: SessionDep, principal: PrincipalDep
) -> EmployeeFullView | EmployeeWorkView | JSONResponse:
    try:
        with _http_errors():
            employee = svc.create_employee(session, principal, data)
    except svc.DuplicateProfile as exc:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": str(exc), "existing_employee_id": str(exc.existing_employee_id)},
        )
    return svc.to_view(employee, principal)


@router.get("/me", response_model=None)
def get_my_profile(
    session: SessionDep, principal: PrincipalDep
) -> EmployeeFullView | EmployeeWorkView:
    with _http_errors():
        return svc.to_view(svc.get_own_employee(session, principal), principal)


@router.get("/options")
def get_options(session: SessionDep, principal: PrincipalDep) -> EmployeeOptions:
    with _http_errors():
        return svc.get_options(session, principal)


@router.get("/{employee_id}", response_model=None)
def get_profile(
    employee_id: UUID, session: SessionDep, principal: PrincipalDep
) -> EmployeeFullView | EmployeeWorkView:
    with _http_errors():
        return svc.to_view(svc.get_visible_employee(session, principal, employee_id), principal)


@router.patch("/{employee_id}/work", response_model=None)
def update_work(
    employee_id: UUID, data: WorkDetailsUpdate, session: SessionDep, principal: PrincipalDep
) -> EmployeeFullView | EmployeeWorkView:
    with _http_errors():
        employee = svc.update_work_details(session, principal, employee_id, data)
        return svc.to_view(employee, principal)


@router.patch("/{employee_id}/personal", response_model=None)
def update_personal(
    employee_id: UUID, data: PersonalDetailsUpdate, session: SessionDep, principal: PrincipalDep
) -> EmployeeFullView | EmployeeWorkView:
    with _http_errors():
        employee = svc.update_personal_details(session, principal, employee_id, data)
        return svc.to_view(employee, principal)


@router.post("/{employee_id}/leaver", response_model=None)
def mark_leaver(
    employee_id: UUID, session: SessionDep, principal: PrincipalDep
) -> EmployeeFullView | EmployeeWorkView:
    with _http_errors():
        return svc.to_view(svc.mark_leaver(session, principal, employee_id), principal)
