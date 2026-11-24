from uuid import UUID

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="API_")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/core_api"
    # Stopgap for the caller's organisation until token verification exists (ADR-0004).
    # Set API_DEFAULT_ORGANISATION_ID explicitly in every deployed environment.
    default_organisation_id: UUID = UUID("00000000-0000-0000-0000-000000000001")


settings = Settings()
