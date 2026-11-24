from uuid import UUID

from app.config import settings


def current_organisation_id() -> UUID:
    """The caller's organisation. Single seam to replace with Cognito-based tenancy."""
    return settings.default_organisation_id
