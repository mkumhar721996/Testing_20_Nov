from datetime import date
from uuid import UUID, uuid4

import pytest

from app.auth import Caller
from app.services.employment_structure import (
    Choices,
    EmployeeState,
    StructureError,
    StructureInput,
    apply_structure,
    can_view_history,
)

TODAY = date(2024, 6, 1)
ORG = uuid4()
J_ACCT, J_SEN = uuid4(), uuid4()
D_FIN, D_ENG = uuid4(), uuid4()
M_HANNAH, M_DANIEL = uuid4(), uuid4()
EMP = uuid4()
CHOICES = Choices(
    jobs={J_ACCT: "Accountant", J_SEN: "Senior accountant"},
    departments={D_FIN: "Finance", D_ENG: "Engineering"},
    managers={M_HANNAH: "Hannah Brooks", M_DANIEL: "Daniel Whitfield"},
)
EFFECTIVE = date(2024, 3, 1)


def employee(job_id=J_ACCT, department_id=D_FIN, manager_id=M_HANNAH):
    return EmployeeState(
        id=EMP, job_id=job_id, department_id=department_id, manager_id=manager_id
    )


def changing_only(field, new):
    values = {"job_id": J_ACCT, "department_id": D_FIN, "manager_id": M_HANNAH}
    values[f"{field}_id"] = new
    return StructureInput(effective_date=EFFECTIVE, **values)


def test_saving_with_a_job_makes_it_the_current_job():
    emp, _ = apply_structure(
        employee(job_id=None), StructureInput(J_ACCT, D_FIN, M_HANNAH, EFFECTIVE), CHOICES, TODAY
    )
    assert emp.job_id == J_ACCT


def test_first_assignment_writes_no_history():
    _, history = apply_structure(
        employee(job_id=None), StructureInput(J_ACCT, D_FIN, M_HANNAH, None), CHOICES, TODAY
    )
    assert history == []


def test_missing_department_is_refused():
    with pytest.raises(StructureError) as e:
        apply_structure(
            employee(), StructureInput(J_ACCT, None, M_HANNAH, EFFECTIVE), CHOICES, TODAY
        )
    assert "department_id" in e.value.errors


def test_missing_manager_is_refused():
    with pytest.raises(StructureError) as e:
        apply_structure(employee(), StructureInput(J_ACCT, D_FIN, None, EFFECTIVE), CHOICES, TODAY)
    assert "manager_id" in e.value.errors


def test_unknown_ids_are_refused():
    with pytest.raises(StructureError) as e:
        apply_structure(
            employee(), StructureInput(J_ACCT, uuid4(), uuid4(), EFFECTIVE), CHOICES, TODAY
        )
    assert {"department_id", "manager_id"} <= set(e.value.errors)


def test_changing_department_stores_only_the_new_one():
    emp, _ = apply_structure(employee(), changing_only("department", D_ENG), CHOICES, TODAY)
    assert emp.department_id == D_ENG


def test_changing_manager_stores_only_the_new_one():
    emp, _ = apply_structure(employee(), changing_only("manager", M_DANIEL), CHOICES, TODAY)
    assert emp.manager_id == M_DANIEL


@pytest.mark.parametrize(
    "field,new,old_name,new_name",
    [
        ("job", J_SEN, "Accountant", "Senior accountant"),
        ("department", D_ENG, "Finance", "Engineering"),
        ("manager", M_DANIEL, "Hannah Brooks", "Daniel Whitfield"),
    ],
)
def test_a_change_to_any_one_field_is_recorded_with_its_effective_date(
    field, new, old_name, new_name
):
    _, history = apply_structure(employee(), changing_only(field, new), CHOICES, TODAY)
    assert [(h.field, h.effective_date) for h in history] == [(field, EFFECTIVE)]
    assert (history[0].from_name, history[0].to_name) == (old_name, new_name)
    assert history[0].to_id == new


def test_changing_two_fields_gives_two_entries_sharing_the_date():
    _, history = apply_structure(
        employee(), StructureInput(J_SEN, D_ENG, M_HANNAH, EFFECTIVE), CHOICES, TODAY
    )
    assert [(h.field, h.effective_date) for h in history] == [
        ("job", EFFECTIVE),
        ("department", EFFECTIVE),
    ]


def test_change_without_effective_date_is_refused():
    with pytest.raises(StructureError) as e:
        apply_structure(
            employee(), StructureInput(J_ACCT, D_ENG, M_HANNAH, None), CHOICES, TODAY
        )
    assert "effective_date" in e.value.errors


def test_no_change_is_refused():
    with pytest.raises(StructureError) as e:
        apply_structure(
            employee(), StructureInput(J_ACCT, D_FIN, M_HANNAH, EFFECTIVE), CHOICES, TODAY
        )
    assert "form" in e.value.errors


def caller(role, employee_id=None):
    return Caller(user_id=uuid4(), organisation_id=ORG, role=role, employee_id=employee_id)


def test_hr_and_the_employee_can_view_history():
    assert can_view_history(caller("hr"), EMP) is True
    assert can_view_history(caller("employee", EMP), EMP) is True


@pytest.mark.parametrize("other", [None, uuid4()])
def test_others_cannot_view_history(other):
    assert can_view_history(caller("employee", other), EMP) is False


def test_manager_cannot_view_history():
    assert can_view_history(caller("manager", uuid4()), EMP) is False


def test_uuid_type_used():
    assert isinstance(EMP, UUID)
