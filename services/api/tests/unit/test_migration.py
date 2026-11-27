import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

API_ROOT = Path(__file__).resolve().parents[2]


def test_migration_creates_tables_and_constraints(tmp_path):
    url = f"sqlite:///{tmp_path / 'm.db'}"
    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url)
    cfg.set_main_option("script_location", str(API_ROOT / "migrations"))

    command.upgrade(cfg, "head")
    engine = create_engine(url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    assert "employees" in tables and "accounts" in tables
    for table in ("employees", "accounts"):
        assert "organisation_id" in {c["name"] for c in inspector.get_columns(table)}

    org, acc = str(uuid.uuid4()), str(uuid.uuid4())
    insert = text(
        "INSERT INTO employees (id, organisation_id, account_id, name, job_title, department,"
        " status, created_at, updated_at) VALUES (:id, :o, :a, 'n', 'j', 'd', 'active',"
        " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    )
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO accounts (id, organisation_id, email, display_name)"
                " VALUES (:a, :o, 'a@x', 'A')"
            ),
            {"a": acc, "o": org},
        )
        conn.execute(insert, {"id": str(uuid.uuid4()), "o": org, "a": acc})
    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(insert, {"id": str(uuid.uuid4()), "o": org, "a": acc})
    engine.dispose()

    command.downgrade(cfg, "base")
    engine = create_engine(url)
    remaining = inspect(engine).get_table_names()
    assert "employees" not in remaining and "accounts" not in remaining
    engine.dispose()
