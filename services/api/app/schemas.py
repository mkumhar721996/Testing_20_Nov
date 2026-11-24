from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

# Non-blank after stripping, capped (the design requires every field on save).
Short = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class WorkDetailsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Short
    job_title: Short
    department: Short
    manager_id: UUID


class EmployeeCreate(WorkDetailsUpdate):
    account_id: UUID


class PersonalDetailsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    personal_phone: Phone
    home_address: Address
    emergency_contact_name: Short
    emergency_contact_phone: Phone


class PersonalDetails(BaseModel):
    personal_phone: str | None
    home_address: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None


class Viewer(BaseModel):
    can_edit_work: bool
    can_edit_personal: bool
    can_mark_leaver: bool


class EmployeeWorkView(BaseModel):
    """What anyone in the organisation may see of an active profile: no personal block."""

    id: UUID
    name: str
    job_title: str
    department: str
    manager_id: UUID | None
    manager_name: str | None
    work_email: str
    status: str
    viewer: Viewer


class EmployeeFullView(EmployeeWorkView):
    """Only for the employee themselves and HR admins."""

    personal: PersonalDetails


class AccountOption(BaseModel):
    id: UUID
    name: str
    email: str
    has_profile: bool


class ManagerOption(BaseModel):
    id: UUID
    name: str


class EmployeeOptions(BaseModel):
    accounts: list[AccountOption]
    departments: list[str]
    managers: list[ManagerOption]
