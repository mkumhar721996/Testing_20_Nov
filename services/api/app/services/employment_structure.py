from dataclasses import dataclass, replace
from datetime import date
from typing import Literal
from uuid import UUID

from app.auth import Caller

Field = Literal["job", "department", "manager"]
FIELDS: tuple[Field, ...] = ("job", "department", "manager")
REQUIRED_MESSAGES = {
    "job": "Choose a job.",
    "department": "Choose a department. The record can't be saved without one.",
    "manager": "Choose a manager. The record can't be saved without one.",
}


class StructureError(Exception):
    def __init__(self, errors: dict[str, str]) -> None:
        super().__init__(", ".join(errors.values()))
        self.errors = errors


@dataclass(frozen=True)
class EmployeeState:
    id: UUID
    job_id: UUID | None
    department_id: UUID
    manager_id: UUID


@dataclass(frozen=True)
class Choices:
    """id -> display name for the caller's organisation."""

    jobs: dict[UUID, str]
    departments: dict[UUID, str]
    managers: dict[UUID, str]

    def names(self, field: Field) -> dict[UUID, str]:
        return {"job": self.jobs, "department": self.departments, "manager": self.managers}[field]


@dataclass(frozen=True)
class StructureInput:
    job_id: UUID | None
    department_id: UUID | None
    manager_id: UUID | None
    effective_date: date | None


@dataclass(frozen=True)
class HistoryEntry:
    field: Field
    from_id: UUID
    to_id: UUID
    from_name: str
    to_name: str
    effective_date: date


def apply_structure(
    emp: EmployeeState, data: StructureInput, choices: Choices, today: date
) -> tuple[EmployeeState, list[HistoryEntry]]:
    """Validate a save and return the new state plus one history entry per changed field."""
    errors: dict[str, str] = {}
    for field in FIELDS:
        new = getattr(data, f"{field}_id")
        if new is None:
            errors[f"{field}_id"] = REQUIRED_MESSAGES[field]
        elif new not in choices.names(field):
            errors[f"{field}_id"] = f"Choose a {field} from the list."
    if errors:
        raise StructureError(errors)

    changed = [f for f in FIELDS if getattr(emp, f"{f}_id") != getattr(data, f"{f}_id")]
    if not changed:
        raise StructureError({"form": "Nothing has changed."})

    entries: list[HistoryEntry] = []
    for field in changed:
        old = getattr(emp, f"{field}_id")
        if old is None:  # first assignment is not a change
            continue
        names = choices.names(field)
        new = getattr(data, f"{field}_id")
        if data.effective_date is None:
            raise StructureError({"effective_date": "Enter the date the change takes effect."})
        entries.append(
            HistoryEntry(
                field=field,
                from_id=old,
                to_id=new,
                from_name=names.get(old, ""),
                to_name=names[new],
                effective_date=data.effective_date,
            )
        )
    new_state = replace(
        emp, job_id=data.job_id, department_id=data.department_id, manager_id=data.manager_id
    )
    return new_state, entries


def can_view_history(caller: Caller, employee_id: UUID) -> bool:
    """HR and the employee themself; managers and everyone else may not."""
    return caller.role == "hr" or caller.employee_id == employee_id
