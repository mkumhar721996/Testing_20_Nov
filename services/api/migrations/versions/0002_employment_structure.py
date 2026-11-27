"""employment structure: departments, jobs, employees, employment history

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _named_table(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organisation_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
    )
    op.create_index(f"ix_{name}_organisation_id", name, ["organisation_id"])


def upgrade() -> None:
    _named_table("departments")
    _named_table("jobs")
    op.create_table(
        "employees",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organisation_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("work_email", sa.String(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("job_id", sa.Uuid(), sa.ForeignKey("jobs.id"), nullable=True),
        sa.Column("department_id", sa.Uuid(), sa.ForeignKey("departments.id"), nullable=False),
        sa.Column("manager_id", sa.Uuid(), sa.ForeignKey("employees.id"), nullable=False),
    )
    op.create_index("ix_employees_organisation_id", "employees", ["organisation_id"])
    op.create_table(
        "employment_history",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organisation_id", sa.Uuid(), nullable=False),
        sa.Column("employee_id", sa.Uuid(), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("field", sa.String(), nullable=False),
        sa.Column("from_id", sa.Uuid(), nullable=True),
        sa.Column("to_id", sa.Uuid(), nullable=False),
        sa.Column("from_name", sa.String(), nullable=True),
        sa.Column("to_name", sa.String(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_by", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "field in ('job', 'department', 'manager')", name="ck_employment_history_field"
        ),
    )
    op.create_index(
        "ix_employment_history_organisation_id", "employment_history", ["organisation_id"]
    )
    op.create_index(
        "ix_employment_history_employee",
        "employment_history",
        ["organisation_id", "employee_id", "effective_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_employment_history_employee", table_name="employment_history")
    op.drop_index("ix_employment_history_organisation_id", table_name="employment_history")
    op.drop_table("employment_history")
    op.drop_index("ix_employees_organisation_id", table_name="employees")
    op.drop_table("employees")
    op.drop_index("ix_jobs_organisation_id", table_name="jobs")
    op.drop_table("jobs")
    op.drop_index("ix_departments_organisation_id", table_name="departments")
    op.drop_table("departments")
