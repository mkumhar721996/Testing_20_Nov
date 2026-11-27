"""Dev seed: `python -m app.seed` adds sample items when the organisation has none."""

from uuid import uuid4

from sqlalchemy import func, select

from app.config import settings
from app.db import SessionLocal
from app.models import Department, Employee, Item, Job

SAMPLE_ITEMS = [
    ("M8 hex bolt, 10 mm", "A-03-12", 240),
    ("Cardboard box, large", "B-07-05", 96),
    ("Pallet wrap roll", "C-01-02", 38),
    ("Stretch film, 500 mm", "D-02-08", 120),
    ("Safety gloves, size L", "A-01-04", 64),
    ("Cable ties, 200 mm", "A-05-10", 726),
]
SAMPLE_JOBS = ["Accountant", "Senior accountant", "Software engineer", "Warehouse operative"]
SAMPLE_DEPARTMENTS = ["Finance", "Engineering", "Operations"]
SAMPLE_EMPLOYEES = ["Hannah Brooks", "Daniel Whitfield", "Priya Nair"]


def seed_employment(session, org) -> None:
    """Jobs, departments and three employees (the first manages the others); idempotent."""
    if session.scalar(
        select(func.count()).select_from(Department).where(Department.organisation_id == org)
    ):
        return
    jobs = [Job(id=uuid4(), organisation_id=org, name=n) for n in SAMPLE_JOBS]
    departments = [Department(id=uuid4(), organisation_id=org, name=n) for n in SAMPLE_DEPARTMENTS]
    session.add_all([*jobs, *departments])
    session.flush()
    lead_id = uuid4()
    for i, name in enumerate(SAMPLE_EMPLOYEES):
        session.add(
            Employee(
                id=lead_id if i == 0 else uuid4(),
                organisation_id=org,
                name=name,
                work_email=f"{name.lower().replace(' ', '.')}@example.com",
                job_id=jobs[i].id,
                department_id=departments[i].id,
                manager_id=lead_id,
            )
        )


def seed() -> int:
    org = settings.default_organisation_id
    with SessionLocal()() as session:
        seed_employment(session, org)
        if session.scalar(select(func.count()).select_from(Item).where(Item.organisation_id == org)):
            session.commit()
            return 0
        session.add_all(
            Item(id=uuid4(), organisation_id=org, name=n, bin=b, on_hand=q)
            for n, b, q in SAMPLE_ITEMS
        )
        session.commit()
        return len(SAMPLE_ITEMS)


if __name__ == "__main__":
    print(f"Seeded {seed()} items")
