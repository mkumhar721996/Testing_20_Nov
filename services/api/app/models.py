from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Index, TypeDecorator
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UtcDateTime(TypeDecorator):
    """timestamptz that always comes back timezone-aware (UTC), on any backend."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organisation_id: Mapped[UUID]
    employee_id: Mapped[UUID]
    clock_in_at: Mapped[datetime] = mapped_column(UtcDateTime)
    clock_out_at: Mapped[datetime | None] = mapped_column(UtcDateTime, default=None)

    @property
    def date(self):
        """UTC date of the clock in; the Web App shows it in the viewer's local time zone."""
        return self.clock_in_at.date()

    __table_args__ = (
        Index(
            "ix_attendance_records_employee_clock_in",
            "organisation_id",
            "employee_id",
            clock_in_at.desc(),
        ),
        # At most one open record per employee, even under concurrent requests.
        Index(
            "uq_attendance_records_one_open",
            "organisation_id",
            "employee_id",
            unique=True,
            postgresql_where=clock_out_at.is_(None),
            sqlite_where=clock_out_at.is_(None),
        ),
    )
