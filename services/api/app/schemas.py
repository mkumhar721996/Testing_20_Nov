from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

NameText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
PhoneText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
AddressText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)
]


class WorkDetailsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: NameText
    job_title: NameText
    department: NameText
    manager_id: UUID


class EmployeeCreate(WorkDetailsUpdate):
    account_id: UUID


class PersonalDetailsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    personal_phone: PhoneText
    home_address: AddressText
    emergency_contact_name: NameText
    emergency_contact_phone: PhoneText


class Viewer(BaseModel):
    can_edit_work: bool
    can_edit_personal: bool
    can_mark_leaver: bool


class PersonalBlock(BaseModel):
    personal_phone: str | None
    home_address: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None


class EmployeeWorkView(BaseModel):
    """What anyone allowed to see an active record gets: no `personal` key at all."""

    id: UUID
    account_id: UUID
    name: str
    job_title: str
    department: str
    manager_id: UUID | None
    manager_name: str | None
    work_email: str
    status: str
    viewer: Viewer


class EmployeeFullView(EmployeeWorkView):
    """Work view plus the personal block, for the employee and HR admins only."""

    personal: PersonalBlock


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
