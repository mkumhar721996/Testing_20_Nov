"""Dev seed: `python -m app.seed` adds sample items when the organisation has none."""

from uuid import uuid4

from sqlalchemy import func, select

from app.config import settings
from app.db import SessionLocal
from app.models import Item

SAMPLE_ITEMS = [
    ("M8 hex bolt, 10 mm", "A-03-12", 240),
    ("Cardboard box, large", "B-07-05", 96),
    ("Pallet wrap roll", "C-01-02", 38),
    ("Stretch film, 500 mm", "D-02-08", 120),
    ("Safety gloves, size L", "A-01-04", 64),
    ("Cable ties, 200 mm", "A-05-10", 726),
]


def seed() -> int:
    org = settings.default_organisation_id
    with SessionLocal()() as session:
        if session.scalar(select(func.count()).select_from(Item).where(Item.organisation_id == org)):
            return 0
        session.add_all(
            Item(id=uuid4(), organisation_id=org, name=n, bin=b, on_hand=q)
            for n, b, q in SAMPLE_ITEMS
        )
        session.commit()
        return len(SAMPLE_ITEMS)


if __name__ == "__main__":
    print(f"Seeded {seed()} items")
