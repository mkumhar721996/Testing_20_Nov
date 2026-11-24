from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.auth import Principal
from app.models import AttendanceRecord
from app.services.attendance import (
    AlreadyClockedIn,
    NotClockedIn,
    clock_in,
    clock_out,
    list_records,
)
from tests.conftest import NOW


def test_clock_in_creates_open_record(session, principal_a):  # AC1
    rec = clock_in(session, principal_a, NOW)
    assert rec.clock_out_at is None
    assert [r.id for r in list_records(session, principal_a)] == [rec.id]


def test_clock_out_closes_same_record(session, principal_a):  # AC2
    rec = clock_in(session, principal_a, NOW)
    out = clock_out(session, principal_a, NOW + timedelta(hours=8))
    assert out.id == rec.id
    assert out.clock_out_at == NOW + timedelta(hours=8)


def test_list_shows_only_own_records(session, principal_a, principal_b):  # AC4
    clock_in(session, principal_b, NOW)
    clock_in(session, principal_a, NOW)
    got = list_records(session, principal_a)
    assert {r.employee_id for r in got} == {principal_a.employee_id}


def test_list_excludes_other_organisation(session, principal_a):  # AC4 / ADR-0009
    other_org = Principal(employee_id=principal_a.employee_id, organisation_id=uuid4())
    clock_in(session, other_org, NOW)
    assert list_records(session, principal_a) == []


def test_second_clock_in_refused_and_original_kept(session, principal_a):  # AC6/7
    clock_in(session, principal_a, NOW)
    with pytest.raises(AlreadyClockedIn):
        clock_in(session, principal_a, NOW + timedelta(hours=1))
    records = list_records(session, principal_a)
    assert len(records) == 1
    assert records[0].clock_in_at == NOW


def test_database_rejects_second_open_record(session, principal_a):  # AC7
    clock_in(session, principal_a, NOW)
    session.add(
        AttendanceRecord(
            organisation_id=principal_a.organisation_id,
            employee_id=principal_a.employee_id,
            clock_in_at=NOW + timedelta(hours=1),
        )
    )
    with pytest.raises(IntegrityError):
        session.commit()


def test_clock_out_when_clocked_out_refused_adds_nothing(session, principal_a):  # AC8/9
    before = len(list_records(session, principal_a))
    with pytest.raises(NotClockedIn):
        clock_out(session, principal_a, NOW)
    assert len(list_records(session, principal_a)) == before


def test_clock_in_again_after_clock_out(session, principal_a):
    clock_in(session, principal_a, NOW)
    clock_out(session, principal_a, NOW + timedelta(hours=8))
    clock_in(session, principal_a, NOW + timedelta(days=1))
    assert len(list_records(session, principal_a)) == 2


def test_records_newest_first(session, principal_a):  # AC10
    for day in range(3):
        clock_in(session, principal_a, NOW + timedelta(days=day))
        clock_out(session, principal_a, NOW + timedelta(days=day, hours=8))
    times = [r.clock_in_at for r in list_records(session, principal_a)]
    assert len(times) == 3
    assert times == sorted(times, reverse=True)
