"""create attendance_records

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organisation_id", sa.Uuid(), nullable=False),
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        sa.Column("clock_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("clock_out_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_attendance_records_employee_clock_in",
        "attendance_records",
        ["organisation_id", "employee_id", sa.text("clock_in_at DESC")],
    )
    op.create_index(
        "uq_attendance_records_one_open",
        "attendance_records",
        ["organisation_id", "employee_id"],
        unique=True,
        postgresql_where=sa.text("clock_out_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_table("attendance_records")
