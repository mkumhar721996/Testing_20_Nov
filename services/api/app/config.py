from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="API_")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/core_api"


settings = Settings()
