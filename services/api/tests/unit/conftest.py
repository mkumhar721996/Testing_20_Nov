import uuid
from collections.abc import Callable, Iterator

import httpx
import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.auth import Principal, get_principal
from app.db import get_session
from app.main import app
from app.models import Account, Base, Employee

ORG = uuid.uuid4()
OTHER_ORG = uuid.uuid4()


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with sessionmaker(engine, expire_on_commit=False)() as s:
        yield s


def make_account(session: Session, name: str, org: uuid.UUID = ORG) -> Account:
    account = Account(
        id=uuid.uuid4(),
        organisation_id=org,
        email=f"{name.lower().replace(' ', '.')}@comp.example",
        display_name=name,
    )
    session.add(account)
    session.commit()
    return account


def make_employee(
    session: Session,
    name: str,
    manager: Employee | None = None,
    status: str = "active",
    org: uuid.UUID = ORG,
) -> Employee:
    account = make_account(session, name, org)
    employee = Employee(
        id=uuid.uuid4(),
        organisation_id=org,
        account_id=account.id,
        name=name,
        job_title="Senior accountant",
        department="Finance",
        manager_id=manager.id if manager else None,
        personal_phone="+44 7700 900123",
        home_address="14 Alder Court\nLeeds LS6 2AB",
        emergency_contact_name="Tobias Okafor (brother)",
        emergency_contact_phone="+44 7700 900456",
        status=status,
    )
    session.add(employee)
    session.commit()
    return employee


@pytest.fixture
def hr_admin() -> Principal:
    return Principal(account_id=uuid.uuid4(), organisation_id=ORG, is_hr_admin=True)


@pytest.fixture
def manager(session: Session) -> Employee:
    return make_employee(session, "Daniel Whitfield")


@pytest.fixture
def other_manager(session: Session) -> Employee:
    return make_employee(session, "Grace Lindqvist")


@pytest.fixture
def employee(session: Session, manager: Employee) -> Employee:
    return make_employee(session, "Amara Okafor", manager)


@pytest.fixture
def leaver(session: Session, manager: Employee) -> Employee:
    return make_employee(session, "Sam Leaver", manager, status="inactive")


@pytest.fixture
def new_account(session: Session):
    return make_account(session, "Lucia Fernandez")


def as_employee(employee: Employee) -> Principal:
    return Principal(
        account_id=employee.account_id, organisation_id=employee.organisation_id, is_hr_admin=False
    )


@pytest.fixture
def client_as(session: Session) -> Iterator[Callable[[Principal], httpx.AsyncClient]]:
    app.dependency_overrides[get_session] = lambda: session

    def build(principal: Principal) -> httpx.AsyncClient:
        app.dependency_overrides[get_principal] = lambda: principal
        return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")

    yield build
    app.dependency_overrides.clear()
