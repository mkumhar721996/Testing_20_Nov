from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
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
