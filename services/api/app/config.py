from uuid import UUID

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="API_")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/core_api"
    # Stopgap for the caller's organisation until token verification exists (ADR-0004).
    # Required (no default) so a deployment that forgets API_DEFAULT_ORGANISATION_ID fails at startup.
    default_organisation_id: UUID


settings = Settings()
