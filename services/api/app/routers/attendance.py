from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import Principal, get_current_principal
from app.db import get_session
from app.models import AttendanceRecord
from app.schemas import AttendanceRecordOut, ClockRequest
from app.services import attendance

router = APIRouter(prefix="/attendance")

CurrentPrincipal = Annotated[Principal, Depends(get_current_principal)]
DbSession = Annotated[Session, Depends(get_session)]


def _refuse(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def _reject_other_employee(body: ClockRequest | None, principal: Principal) -> None:
    if body is not None and body.employee_id not in (None, principal.employee_id):
        raise _refuse(403, "other_employee", "You can only clock yourself in or out.")


@router.get("/records", response_model=list[AttendanceRecordOut])
def get_records(session: DbSession, principal: CurrentPrincipal) -> list[AttendanceRecord]:
    return attendance.list_records(session, principal)


@router.post("/clock-in", status_code=201, response_model=AttendanceRecordOut)
def post_clock_in(
    session: DbSession, principal: CurrentPrincipal, body: ClockRequest | None = None
) -> AttendanceRecord:
    _reject_other_employee(body, principal)
    try:
        return attendance.clock_in(session, principal, datetime.now(UTC))
    except attendance.AlreadyClockedIn:
        raise _refuse(409, "already_clocked_in", "You are already clocked in.") from None


@router.post("/clock-out", response_model=AttendanceRecordOut)
def post_clock_out(
    session: DbSession, principal: CurrentPrincipal, body: ClockRequest | None = None
) -> AttendanceRecord:
    _reject_other_employee(body, principal)
    try:
        return attendance.clock_out(session, principal, datetime.now(UTC))
    except attendance.NotClockedIn:
        raise _refuse(409, "not_clocked_in", "You are not clocked in.") from None
