import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Account(Base):
    """A sign-in account HR can attach an employee profile to."""

    __tablename__ = "accounts"
    __table_args__ = (sa.UniqueConstraint("organisation_id", "email"),)

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, nullable=False)
    email: Mapped[str] = mapped_column(sa.Text, nullable=False)
    display_name: Mapped[str] = mapped_column(sa.Text, nullable=False)


class Employee(Base):
    """The one authoritative HR record per employee."""

    __tablename__ = "employees"
    __table_args__ = (
        sa.UniqueConstraint("organisation_id", "account_id"),
        sa.CheckConstraint("status in ('active','inactive')", name="ck_employees_status"),
        sa.Index("ix_employees_organisation_status", "organisation_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("accounts.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    job_title: Mapped[str] = mapped_column(sa.Text, nullable=False)
    department: Mapped[str] = mapped_column(sa.Text, nullable=False)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("employees.id"), nullable=True
    )
    personal_phone: Mapped[str | None] = mapped_column(sa.Text)
    home_address: Mapped[str | None] = mapped_column(sa.Text)
    emergency_contact_name: Mapped[str | None] = mapped_column(sa.Text)
    emergency_contact_phone: Mapped[str | None] = mapped_column(sa.Text)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )

    account: Mapped[Account] = relationship(lazy="joined")
    manager: Mapped["Employee | None"] = relationship(remote_side=[id], lazy="joined")
