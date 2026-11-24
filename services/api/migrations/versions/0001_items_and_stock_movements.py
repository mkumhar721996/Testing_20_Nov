"""items and stock movements

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
        "items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organisation_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("bin", sa.String(), nullable=False),
        sa.Column("on_hand", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("on_hand >= 0", name="ck_items_on_hand_non_negative"),
    )
    op.create_index("ix_items_organisation_id", "items", ["organisation_id"])
    op.create_table(
        "stock_movements",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organisation_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), sa.ForeignKey("items.id"), nullable=False),
        sa.Column("direction", sa.String(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_stock_movements_quantity_positive"),
        sa.CheckConstraint("direction in ('in', 'out')", name="ck_stock_movements_direction"),
    )
    op.create_index("ix_stock_movements_organisation_id", "stock_movements", ["organisation_id"])


def downgrade() -> None:
    op.drop_index("ix_stock_movements_organisation_id", table_name="stock_movements")
    op.drop_table("stock_movements")
    op.drop_index("ix_items_organisation_id", table_name="items")
    op.drop_table("items")
