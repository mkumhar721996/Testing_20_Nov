from sqlalchemy import Engine, create_engine

from app.config import settings


def make_engine() -> Engine:
    """Create the engine lazily; no connection is opened until first use."""
    return create_engine(settings.database_url, pool_pre_ping=True)
