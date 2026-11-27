"""Create accounts and employees.

Revision ID: 0001_employees
Revises:
"""

import sqlalchemy as sa
from alembic import op

revision = "0001_employees"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organisation_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.UniqueConstraint("organisation_id", "email"),
    )
    op.create_table(
        "employees",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organisation_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("job_title", sa.Text(), nullable=False),
        sa.Column("department", sa.Text(), nullable=False),
        sa.Column("manager_id", sa.Uuid(), sa.ForeignKey("employees.id"), nullable=True),
        sa.Column("personal_phone", sa.Text()),
        sa.Column("home_address", sa.Text()),
        sa.Column("emergency_contact_name", sa.Text()),
        sa.Column("emergency_contact_phone", sa.Text()),
        sa.Column("status", sa.Text(), nullable=False, server_default="active"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("organisation_id", "account_id"),
        sa.CheckConstraint("status in ('active','inactive')", name="ck_employees_status"),
    )
    op.create_index(
        "ix_employees_organisation_status", "employees", ["organisation_id", "status"]
    )


def downgrade() -> None:
    op.drop_index("ix_employees_organisation_status", table_name="employees")
    op.drop_table("employees")
    op.drop_table("accounts")
