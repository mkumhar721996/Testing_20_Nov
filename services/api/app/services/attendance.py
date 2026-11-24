from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import Principal
from app.models import AttendanceRecord


class AlreadyClockedIn(Exception):
    pass


class NotClockedIn(Exception):
    pass


def _own(principal: Principal):
    return (
        AttendanceRecord.organisation_id == principal.organisation_id,
        AttendanceRecord.employee_id == principal.employee_id,
    )


def _open_record(session: Session, principal: Principal) -> AttendanceRecord | None:
    return session.scalars(
        select(AttendanceRecord).where(*_own(principal), AttendanceRecord.clock_out_at.is_(None))
    ).first()


def clock_in(session: Session, principal: Principal, now: datetime) -> AttendanceRecord:
    if _open_record(session, principal) is not None:
        raise AlreadyClockedIn
    record = AttendanceRecord(
        organisation_id=principal.organisation_id,
        employee_id=principal.employee_id,
        clock_in_at=now,
    )
    session.add(record)
    try:
        session.commit()
    except IntegrityError:
        # A concurrent clock in won the race; the partial unique index refused ours.
        session.rollback()
        raise AlreadyClockedIn from None
    return record


def clock_out(session: Session, principal: Principal, now: datetime) -> AttendanceRecord:
    record = _open_record(session, principal)
    if record is None:
        raise NotClockedIn
    record.clock_out_at = now
    session.commit()
    return record


def list_records(session: Session, principal: Principal) -> list[AttendanceRecord]:
    return list(
        session.scalars(
            select(AttendanceRecord)
            .where(*_own(principal))
            .order_by(AttendanceRecord.clock_in_at.desc())
        )
    )
