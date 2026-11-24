from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ClockRequest(BaseModel):
    """Optional body. `employee_id` exists only so a request naming someone else is refused explicitly."""

    employee_id: UUID | None = None


class AttendanceRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    date: date
    clock_in_at: datetime
    clock_out_at: datetime | None
