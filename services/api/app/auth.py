from dataclasses import dataclass
from typing import Literal
from uuid import UUID, uuid4

from fastapi import Header, HTTPException, status

from app.config import settings

Role = Literal["hr", "employee", "manager"]
ROLES = ("hr", "employee", "manager")


@dataclass(frozen=True)
class Caller:
    user_id: UUID
    organisation_id: UUID
    role: Role
    employee_id: UUID | None


def get_caller(
    x_dev_role: str | None = Header(default=None),
    x_dev_employee_id: UUID | None = Header(default=None),
) -> Caller:
    """The authenticated caller. Seam for Access & Roles and Cognito verification (ADR-0004).

    Fails closed: without a verifier, only the off-by-default dev headers can identify a caller.
    """
    if not settings.trust_dev_caller_headers or x_dev_role not in ROLES:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "unauthenticated"})
    return Caller(
        user_id=x_dev_employee_id or uuid4(),
        organisation_id=settings.default_organisation_id,
        role=x_dev_role,  # type: ignore[arg-type]
        employee_id=x_dev_employee_id,
    )
