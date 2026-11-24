import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

API_ROOT = Path(__file__).resolve().parents[2]


def test_migration_creates_tables_and_constraints(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'm.db'}"
    monkeypatch.setattr("app.config.settings.database_url", url)
    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "migrations"))

    command.upgrade(cfg, "head")
    engine = create_engine(url)
    inspector = inspect(engine)
    assert {"employees", "accounts"} <= set(inspector.get_table_names())
    for table in ("employees", "accounts"):
        assert "organisation_id" in {c["name"] for c in inspector.get_columns(table)}

    org, acc = str(uuid.uuid4()), str(uuid.uuid4())
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO accounts VALUES (:id, :org, 'a@b.c', 'A')"),
            {"id": acc, "org": org},
        )
    insert = text(
        "INSERT INTO employees (id, organisation_id, account_id, name, job_title, department,"
        " status, created_at, updated_at) VALUES (:id, :org, :acc, 'n', 'j', 'd', 'active',"
        " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    )
    with engine.begin() as conn:
        conn.execute(insert, {"id": str(uuid.uuid4()), "org": org, "acc": acc})
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(insert, {"id": str(uuid.uuid4()), "org": org, "acc": acc})
    engine.dispose()

    command.downgrade(cfg, "base")
    engine = create_engine(url)
    assert not {"employees", "accounts"} & set(inspect(engine).get_table_names())
