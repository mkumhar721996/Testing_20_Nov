from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings


def make_engine() -> Engine:
    """Create the engine lazily; no connection is opened until first use."""
    return create_engine(settings.database_url, pool_pre_ping=True)


@lru_cache
def SessionLocal() -> sessionmaker[Session]:
    return sessionmaker(make_engine(), expire_on_commit=False)


def get_session() -> Iterator[Session]:
    session = SessionLocal()()
    try:
        yield session
    finally:
        session.close()
