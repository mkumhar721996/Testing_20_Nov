from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException, Request, status


@dataclass(frozen=True)
class Principal:
    """Who is calling, as claimed by a Cognito-issued token (ADR-0004)."""

    account_id: UUID
    organisation_id: UUID
    is_hr_admin: bool


def get_principal(request: Request) -> Principal:
    """The one place the API learns who is calling.

    Fails closed: token verification needs the Cognito JWKS fetch, which ADR-0010 requires
    recording as an integration first, so until that lands every request is unauthenticated.
    Tests override this dependency.
    """
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated.",
        headers={"WWW-Authenticate": "Bearer"},
    )
