from collections.abc import Iterator
from uuid import UUID, uuid4

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import get_session
from app.main import app
from app.models import Base, Item
from app.tenancy import current_organisation_id

ORG = UUID("00000000-0000-0000-0000-0000000000a1")
OTHER_ORG = UUID("00000000-0000-0000-0000-0000000000b2")


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with sessionmaker(engine, expire_on_commit=False)() as s:
        yield s


@pytest.fixture
def item_a(session: Session) -> Item:
    item = Item(id=uuid4(), organisation_id=ORG, name="Item A", bin="A-01", on_hand=3)
    session.add(item)
    session.commit()
    return item


@pytest.fixture
async def client(session: Session) -> httpx.AsyncClient:
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[current_organisation_id] = lambda: ORG
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
