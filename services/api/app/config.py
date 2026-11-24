from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="API_")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/core_api"

    # Identity Provider (Amazon Cognito) token verification. While any is unset,
    # every protected route answers 401.
    idp_jwks_url: str = ""  # API_IDP_JWKS_URL
    idp_issuer: str = ""  # API_IDP_ISSUER
    idp_audience: str = ""  # API_IDP_AUDIENCE
    # Token claims carrying the employee and organisation ids.
    idp_employee_claim: str = "sub"
    idp_organisation_claim: str = "custom:organisation_id"


settings = Settings()
