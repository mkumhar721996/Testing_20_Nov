from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.config import settings


def make_engine() -> Engine:
    """Create the engine lazily; no connection is opened until first use."""
    return create_engine(settings.database_url, pool_pre_ping=True)


@lru_cache
def _engine() -> Engine:
    return make_engine()


def get_session() -> Iterator[Session]:
    with Session(_engine()) as session:
        yield session
