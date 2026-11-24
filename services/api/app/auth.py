from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Header, HTTPException
from pydantic import BaseModel

from app.config import settings


class Principal(BaseModel):
    """The verified caller. Always taken from the token, never from a request body."""

    employee_id: UUID
    organisation_id: UUID


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url)


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=401, detail="Not authenticated")


def get_current_principal(authorization: str = Header(default="")) -> Principal:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized()
    if not (settings.idp_jwks_url and settings.idp_issuer and settings.idp_audience):
        raise _unauthorized()
    try:
        key = _jwks_client(settings.idp_jwks_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            issuer=settings.idp_issuer,
            audience=settings.idp_audience,
        )
        return Principal(
            employee_id=UUID(str(claims[settings.idp_employee_claim])),
            organisation_id=UUID(str(claims[settings.idp_organisation_claim])),
        )
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _unauthorized() from None
