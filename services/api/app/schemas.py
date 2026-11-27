from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MovementCreate(BaseModel):
    item_id: UUID
    quantity: int = Field(gt=0)
    direction: Literal["in", "out"]


class MovementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item_id: UUID
    quantity: int
    direction: Literal["in", "out"]
    occurred_at: datetime


class ItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    bin: str
    on_hand: int


class RecentMovement(BaseModel):
    id: UUID
    occurred_at: datetime
    item_name: str
    bin: str
    direction: Literal["in", "out"]
    quantity: int


class DashboardRead(BaseModel):
    items_in_stock: int
    movements_today: int
    item_count: int
    recent_movements: list[RecentMovement]


class NamedRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class EmployeeRead(BaseModel):
    id: UUID
    name: str
    job: NamedRef | None
    department: NamedRef
    manager: NamedRef
    viewer: Literal["hr", "self", "manager"]


class StructureUpdate(BaseModel):
    job_id: UUID | None = None
    department_id: UUID | None = None
    manager_id: UUID | None = None
    effective_date: date | None = None


class HistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    field: Literal["job", "department", "manager"]
    from_name: str | None
    to_name: str
    effective_date: date
    recorded_at: datetime
