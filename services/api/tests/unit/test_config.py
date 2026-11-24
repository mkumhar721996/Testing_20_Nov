import pytest
from pydantic import ValidationError

from app.config import Settings


def test_default_organisation_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("API_DEFAULT_ORGANISATION_ID", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
