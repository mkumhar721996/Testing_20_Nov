from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.auth import Principal
from app.models import Base

NOW = datetime(2026, 11, 23, 8, 58, tzinfo=UTC)


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


@pytest.fixture
def organisation_id():
    return uuid4()


@pytest.fixture
def principal_a(organisation_id) -> Principal:
    return Principal(employee_id=uuid4(), organisation_id=organisation_id)


@pytest.fixture
def principal_b(organisation_id) -> Principal:
    return Principal(employee_id=uuid4(), organisation_id=organisation_id)
