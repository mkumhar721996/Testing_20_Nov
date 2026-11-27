from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException, Request, status


@dataclass(frozen=True)
class Principal:
    """Who is calling: the claims the Core API authorises every request against."""

    account_id: UUID
    organisation_id: UUID
    is_hr_admin: bool


def get_principal(request: Request) -> Principal:
    """The single place the API learns who is calling.

    Fails closed until the Cognito token verifier lands (ADR-0004, ADR-0010); tests
    override this dependency.
    """
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sign in to continue.",
        headers={"WWW-Authenticate": "Bearer"},
    )
