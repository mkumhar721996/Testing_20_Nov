from datetime import date, datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (CheckConstraint("on_hand >= 0", name="ck_items_on_hand_non_negative"),)

    id: Mapped[UUID] = mapped_column(primary_key=True)
    organisation_id: Mapped[UUID] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String)
    bin: Mapped[str] = mapped_column(String)
    on_hand: Mapped[int] = mapped_column(default=0)


class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_stock_movements_quantity_positive"),
        CheckConstraint("direction in ('in', 'out')", name="ck_stock_movements_direction"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    organisation_id: Mapped[UUID] = mapped_column(index=True)
    item_id: Mapped[UUID] = mapped_column(ForeignKey("items.id"))
    direction: Mapped[str] = mapped_column(String)
    quantity: Mapped[int]
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Department(Base):
    """Flat list: deliberately no parent column."""

    __tablename__ = "departments"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    organisation_id: Mapped[UUID] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    organisation_id: Mapped[UUID] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String)


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    organisation_id: Mapped[UUID] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String)
    work_email: Mapped[str] = mapped_column(String)
    start_date: Mapped[date | None] = mapped_column(Date)
    job_id: Mapped[UUID | None] = mapped_column(ForeignKey("jobs.id"))
    department_id: Mapped[UUID] = mapped_column(ForeignKey("departments.id"))
    manager_id: Mapped[UUID] = mapped_column(ForeignKey("employees.id"))


class EmploymentHistory(Base):
    __tablename__ = "employment_history"
    __table_args__ = (
        CheckConstraint(
            "field in ('job', 'department', 'manager')", name="ck_employment_history_field"
        ),
        Index("ix_employment_history_employee", "organisation_id", "employee_id", "effective_date"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    organisation_id: Mapped[UUID] = mapped_column(index=True)
    employee_id: Mapped[UUID] = mapped_column(ForeignKey("employees.id"))
    field: Mapped[str] = mapped_column(String)
    from_id: Mapped[UUID | None]
    to_id: Mapped[UUID]
    from_name: Mapped[str | None] = mapped_column(String)
    to_name: Mapped[str] = mapped_column(String)
    effective_date: Mapped[date] = mapped_column(Date)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recorded_by: Mapped[UUID]
