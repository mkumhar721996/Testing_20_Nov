summary: |
  Build the HR employee record end to end: a PostgreSQL-backed `employees` table (plus a minimal `accounts` table HR picks the employee from), Core API endpoints to create a profile (one per employee), view it, edit HR-owned work details (name, job title, department, manager), edit employee-owned personal details (phone, home address, emergency contact), and mark a leaver inactive. All visibility and edit rules live in one server-side permissions module so the personal fields are never sent to anyone but the employee and HR admins, and inactive records are 404 for everyone but HR admins. The Web App gets the approved Employee profile screen (work-details and personal-contact cards, edit drawers, leaver confirm modal, loading/error/not-available states) and the Create employee profile screen, built on the design-system tokens and component classes. The repo today has no auth, no migrations, no router and no shell, so the plan also adds the thin seams this story needs (principal dependency, Alembic, react-router, app shell) and flags the parts that belong to other stories.

scope:
  - description: |
      Add Alembic and migration 0001 creating `accounts` and `employees` (both carry `organisation_id`, ADR-0009).
      `accounts(id uuid pk, organisation_id uuid not null, email text not null, display_name text not null, unique(organisation_id, email))` is the Core API's local list of sign-in accounts HR can pick from (the design's "Employee" select).
      `employees(id uuid pk, organisation_id uuid not null, account_id uuid not null fk accounts.id, name text not null, job_title text not null, department text not null, manager_id uuid null fk employees.id, personal_phone text null, home_address text null, emergency_contact_name text null, emergency_contact_phone text null, status text not null default 'active' check in ('active','inactive'), created_at, updated_at, unique(organisation_id, account_id))`.
      The unique constraint is the database backstop for AC2 (no second profile); the service also checks first so it can return a clear 409. Use portable types (`sa.Uuid`, `sa.Text`, `sa.DateTime(timezone=True)`) so the migration also runs on SQLite in unit tests. Add an index on `(organisation_id, status)`.
    files:
      - services/api/pyproject.toml
      - services/api/alembic.ini
      - services/api/migrations/env.py
      - services/api/migrations/versions/0001_employees.py
      - services/api/app/models.py
    rationale: |
      No schema or migration tooling exists yet (re-checked `services/api` this session: only `app/{config,db,main}.py`, `routers/health.py`, and two health tests). ADR-0003/0009 require the data in PostgreSQL, tenant-scoped.

  - description: |
      Add the request principal seam in `app/auth.py` and wire a session dependency in `app/db.py`.
      ```python
      @dataclass(frozen=True)
      class Principal:
          account_id: UUID
          organisation_id: UUID
          is_hr_admin: bool

      def get_principal(request: Request) -> Principal: ...   # fail-closed: 401 until a verifier is configured
      ```
      `get_principal` is the single place the rest of the code learns who is calling. ADR-0004 says only Cognito-issued tokens are accepted, and verifying them needs the Cognito JWKS fetch, which ADR-0010 says must be recorded as an integration first. So this story delivers the dependency, the `Principal` shape (claims: account id, organisation id, `hr_admin` group) and a default that returns 401; tests override it. Wiring the real verifier is an open question below, not hidden work.
      In `app/db.py` add `get_session() -> Iterator[Session]` using a lazily created `sessionmaker(make_engine())`. In `app/config.py` add `cors_origins: list[str] = ["http://localhost:5173"]` (env `API_CORS_ORIGINS`) and register `CORSMiddleware` in `app/main.py` so the Web App can call the API.
    files:
      - services/api/app/auth.py
      - services/api/app/db.py
      - services/api/app/config.py
      - services/api/app/main.py
    rationale: |
      ADR-0002/0004: the Core API authorises every request against the caller; every service function below takes a `Principal` and filters by `principal.organisation_id`.

  - description: |
      Permissions and domain rules in `app/services/employees.py` (pure, session-based, no HTTP types) with errors `EmployeeNotFound`, `NotPermitted`, `DuplicateProfile(existing_employee_id)`, `InvalidReference`, `AlreadyInactive`.
      ```python
      def create_employee(session: Session, principal: Principal, data: EmployeeCreate) -> Employee
      def get_visible_employee(session: Session, principal: Principal, employee_id: UUID) -> Employee
      def update_work_details(session: Session, principal: Principal, employee_id: UUID, data: WorkDetailsUpdate) -> Employee
      def update_personal_details(session: Session, principal: Principal, employee_id: UUID, data: PersonalDetailsUpdate) -> Employee
      def mark_leaver(session: Session, principal: Principal, employee_id: UUID) -> Employee
      def to_view(employee: Employee, principal: Principal) -> EmployeeWorkView | EmployeeFullView
      ```
      Rules (one function `capabilities(employee, principal)` is the only place they are written):
      - Every query filters `Employee.organisation_id == principal.organisation_id`; another organisation's id behaves as not found.
      - `get_visible_employee`: HR admin sees any record; anyone else sees only `status == 'active'`; an inactive record raises `EmployeeNotFound` for them (404, so existence is not leaked) - AC7/AC8. That includes the leaver themselves (see the AC8 vs AC11 conflict in the open questions).
      - `to_view`: the personal block (phone, home address, emergency contact name and phone) is included only when the viewer is the employee (`principal.account_id == employee.account_id`) or an HR admin; otherwise the returned model is `EmployeeWorkView`, which has no `personal` key at all - AC9/AC10. The view also carries `viewer: {can_edit_work, can_edit_personal, can_mark_leaver}` computed from the same rules so the UI never re-implements them.
      - `create_employee`: HR admin only; the account must belong to the caller's organisation and the manager (required) must be an active employee in it, otherwise `InvalidReference`; an existing `(organisation_id, account_id)` raises `DuplicateProfile` and inserts nothing; also catch `IntegrityError` from the unique constraint (race) and raise the same error - AC1/AC2.
      - `update_work_details`: HR admin only, only on an active record; changes name, job_title, department, manager_id; manager cannot be the employee themselves - AC3, AC5.
      - `update_personal_details`: only the employee themselves, only while active; HR admins and managers get `NotPermitted`; a leaver gets `EmployeeNotFound` (they cannot see the record) - AC4, AC11. Work fields are not in `PersonalDetailsUpdate`, so a body carrying `name` is rejected by `extra='forbid'` - AC5.
      - `mark_leaver`: HR admin only; active -> inactive; already inactive raises `AlreadyInactive` (409) and changes nothing - AC6. Reactivation is not built (the design says a leaver is not reactivated here).
    files:
      - services/api/app/services/__init__.py
      - services/api/app/services/employees.py
      - services/api/app/schemas.py
    rationale: |
      Keeps the privacy rules in one testable place, independent of FastAPI, so the router is thin and cannot drift from the rules.

  - description: |
      HTTP surface in `app/routers/employees.py`, registered in `app/main.py`. Error mapping: `EmployeeNotFound` -> 404, `NotPermitted` -> 403, `DuplicateProfile` -> 409 with body `{"detail": "...", "existing_employee_id": "<uuid>"}`, `InvalidReference` -> 422, `AlreadyInactive` -> 409. Routes (return model instances with `response_model=None` so the `personal` key is genuinely absent for non-owners):
      - `POST /employees` (HR) -> 201 `EmployeeFullView`
      - `GET /employees/me` -> the caller's own profile (404 if none); declared before `/{employee_id}`
      - `GET /employees/options` (HR) -> `{accounts: [{id, name, email, has_profile}], departments: [str], managers: [{id, name}]}` feeding the create form and work-details drawer
      - `GET /employees/{employee_id}`
      - `PATCH /employees/{employee_id}/work` (HR)
      - `PATCH /employees/{employee_id}/personal` (the employee)
      - `POST /employees/{employee_id}/leaver` (HR)
      Schemas use Pydantic validation that matches the design's messages' intent: name, job title, department non-blank after strip; the four personal fields non-blank on save (the design's drawer requires all four); lengths capped (name/title/department 200, phone 40, address 1000).
    files:
      - services/api/app/routers/employees.py
      - services/api/app/main.py
    rationale: |
      Core API is the only component that reads or writes the database (ADR-0002); the Web App reaches data only through it (ADR-0001).

  - description: |
      Web App foundations the screens need. (1) Load the design system once in `apps/web/src/index.css` after `@import "tailwindcss";`: `@import "../design/tokens.css";` and `@import "../design/prototype-utils.css";` - tokens.css defines the real `--color-*`, `--space-*`, `--size-*` names, and prototype-utils.css defines `.btn*`, `.field*`, `.input`, `.card`, `.badge*`, `.alert*`, `.drawer`, `.modal`, `.toast`, `.skeleton`, `.empty-state`, `.stack*`, `.cluster`, `.grid`. Today index.css only imports tailwindcss (line 1) and main.tsx imports index.css (line 4), so nothing loads the tokens yet. (2) Add `react-router-dom` and a router in `main.tsx`/`App.tsx` with routes `/employees/new`, `/employees/me` (redirects to own profile id) and `/employees/:employeeId`. (3) `src/api/client.ts`: a small `fetch` wrapper reading `import.meta.env.VITE_API_BASE_URL` (default `http://localhost:8000`) and attaching the bearer token from `src/auth/token.ts` (`getAccessToken(): string | null`, the one seam the Cognito sign-in story replaces); throws `ApiError {status, body}`. (4) `src/api/employees.ts`: typed functions mirroring the endpoints above and the `EmployeeWorkView | EmployeeFullView` types.
    files:
      - apps/web/src/index.css
      - apps/web/src/main.tsx
      - apps/web/src/App.tsx
      - apps/web/src/api/client.ts
      - apps/web/src/api/employees.ts
      - apps/web/src/auth/token.ts
      - apps/web/package.json
    rationale: |
      The design's classes are only available once the design stylesheets are imported; no router, API client or shell exists in the app yet (App.tsx is a placeholder heading).

  - description: |
      App shell and shared overlay components, matching the prototype's `.shell` markup: `src/shell/AppShell.tsx` renders the top bar (brand, "Menu" toggle button below 48rem, nav links Overview, Items, Reports, Settings with `data-nav-key`, Account at the right with `data-nav-key="account"`), `<main id="content">` in a `size-container` column, and the footer; the Items link has `aria-current="page"` on every employee screen. The shell, `.kv`, `.page-head`, `.who`, `.card-head`, `.backlink`, `.narrow`, `.drawer-head`, `.dd-actions`, `.skel-*` and the `.avatar`-header rules are NOT defined in any stylesheet in `apps/web/design/` (`prototype-utils.css` does not define them; the shell rules exist only inside `design/app-shell.html` and the rest only in the prototype's inline `<style>`), so define them in `src/shell/shell.css` and `src/features/employees/employees.css` using only tokens, copied from the prototype: `--space-2/3/4`, `--size-tap`, `--size-container`, `--size-icon`, `--font-size-sm/lg/xl`, `--color-fg-muted`, `--color-info-bg`, `--color-info`, `--color-primary`, `--color-border`, `--radius-md`, `--duration-fast`, `--line-height-tight`; the 48rem and 40rem media-query widths stay literal because media queries cannot read tokens (as the prototype notes). Components: `src/components/Drawer.tsx` (role="dialog", aria-modal, labelled by its title, focus moves in, Tab trapped, Escape and backdrop close, focus returns to trigger), `src/components/ConfirmModal.tsx` (same behaviour, `.modal`), `src/components/Toast.tsx` (`role="status"`, auto-hide 4 s, `.toast`).
    files:
      - apps/web/src/shell/AppShell.tsx
      - apps/web/src/shell/shell.css
      - apps/web/src/components/Drawer.tsx
      - apps/web/src/components/ConfirmModal.tsx
      - apps/web/src/components/Toast.tsx
      - apps/web/src/features/employees/employees.css
    rationale: |
      UI guidelines: top bar only, Menu collapse below 48rem, each screen marks its section, drawers for editing a record, modals only for confirmations, toast for completed actions.

  - description: |
      Employee profile screen `src/features/employees/EmployeeProfilePage.tsx` (route `/employees/:employeeId`), built from the prototype's "Employee profile" screen:
      - Header (`.page-head`): `.avatar` with initials, `h1` name, `.badge-success` "Active" or `.badge-neutral` "Inactive", then "job title, department" in `.text-muted`; actions cluster shown only when `viewer.can_edit_work`: one `.btn-primary` "Edit work details", `.btn-secondary` "Mark as leaver", `.btn-ghost` "Add employee" linking to `/employees/new`. "Back to directory" is a `.backlink`; the directory is a separate story, so it links to the Items root (the prototype only toasts that it is a later story).
      - "Work details" `.card` with `.kv` list: Name, Job title, Department, Manager (manager name from the API) and Work email (the account's email); badge "Edited by HR" for HR, "Managed by HR" otherwise (AC5: no form controls for these fields unless HR opens the drawer). The prototype's Employee ID and Start date rows are NOT built: no AC, no create-form input and no column for them (see open questions).
      - "Personal contact details" `.card`: when `personal` is present show Personal phone, Home address (line breaks kept), Emergency contact (name and phone) with badge "Edited by the employee" for HR or an "Edit contact details" `.btn-primary` for the employee; when `personal` is absent show the "Not shown. Only {first name} and HR admins can see these." text (AC9). A `.alert-info` note above the cards for the employee ("You can update your own contact details...") and for a manager, as in the prototype.
      - Edit work details `Drawer` ("Edit work details", fields Full name, Job title, Department, Manager, `.btn-primary` "Save work details", `.btn-secondary` "Cancel"); Edit contact details `Drawer` (Personal phone, Home address `textarea`, Emergency contact name with the relationship hint, Emergency contact phone; "Save contact details"). Every control sits in a `.field` with `.field-label`; blank required values show `.field-error` text and `.is-invalid` with `aria-invalid`, using the prototype's messages (e.g. "Enter the employee's full name."). Save shows "Saving…" on the button, closes the drawer, updates the profile from the response and shows the toast "Work details saved." / "Contact details saved.". A 403/409/422 from the API shows an `.alert-danger` inside the drawer and keeps it open (toasts never carry the only error).
      - Leaver `ConfirmModal` "Mark {name} as a leaver?" with `.btn-secondary` "Keep as active" and `.btn-danger` "Mark as leaver"; on success the badge becomes "Inactive", the actions disappear, an `.alert-warning` "Inactive leaver. Only HR admins can see this record. It is read-only." shows, and the toast "{name} is marked as a leaver." appears (AC6, AC7).
      - States: loading = `.card` of `.skeleton` lines with `aria-busy="true"`; 404 = `.empty-state` "This profile isn't available" with the prototype's text and a `.btn-primary` "Search the directory" (links to Items root until the directory story exists) (AC8); other failures = `.alert-danger` "We couldn't load this profile." with a `.btn-secondary` "Try again" that refetches.
    files:
      - apps/web/src/features/employees/EmployeeProfilePage.tsx
      - apps/web/src/features/employees/WorkDetailsDrawer.tsx
      - apps/web/src/features/employees/PersonalDetailsDrawer.tsx
      - apps/web/src/features/employees/useEmployee.ts
      - apps/web/src/features/employees/validation.ts
    rationale: |
      One screen, rendered from the server's `viewer` capabilities and the presence of `personal`, so the browser never decides who may see what.

  - description: |
      Create employee profile screen `src/features/employees/CreateEmployeePage.tsx` (route `/employees/new`, HR only; a non-HR caller gets the same not-available empty state because `GET /employees/options` returns 403): `.narrow` column, `h1` "Create employee profile", `.alert-info` "Each employee has one profile...", one `.card` `form` with fields Employee (`select` fed by `options.accounts`, accounts that already have a profile marked "(profile exists)"; choosing one prefills Full name), Full name, Job title, Department, Manager in a `.grid`, `.btn-primary` "Create profile" ("Creating…" while pending) and `.btn-ghost` "Cancel". Field errors use the prototype's messages ("Choose an employee to continue.", "Enter a job title, for example Payroll analyst."). Success shows `.alert-success` "Profile created for {name}." with a `.btn-secondary` "Open profile" (AC1). A 409 shows `.alert-danger` "{name} already has a profile. No second profile was created..." with `.btn-secondary` "Open existing profile" linking to `existing_employee_id` (AC2). Department: the prototype uses a `select`, but there is no department list to fill it (see open questions); build an `input` with a `datalist` of `options.departments` (existing departments in the organisation) - one deliberate deviation from the prototype, called out for the reviewer.
    files:
      - apps/web/src/features/employees/CreateEmployeePage.tsx
    rationale: |
      AC1 and AC2 need a screen; the prototype's "Create employee profile" screen shows default, duplicate and success states.

tests:
  - |
    AC1 - API unit test (`services/api/tests/unit/test_employees_api.py`, httpx `ASGITransport` + in-memory SQLite session + `app.dependency_overrides[get_principal]`), written first and failing with 404 because the route does not exist:
    ```python
    async def test_hr_admin_creates_profile(client_as, account, manager):
        resp = await client_as(hr_admin).post("/employees", json={
            "account_id": str(account.id), "name": "Lucia Fernandez",
            "job_title": "Payroll analyst", "department": "Finance", "manager_id": str(manager.id)})
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Lucia Fernandez" and body["status"] == "active"
        assert body["personal"]["personal_phone"] is None
    async def test_non_hr_cannot_create(client_as, account, manager):
        resp = await client_as(plain_employee).post("/employees", json=payload)
        assert resp.status_code == 403
    ```
    Plus service-level `test_create_rejects_account_from_other_organisation` asserting `InvalidReference`.
  - |
    AC2 - service and API tests:
    ```python
    async def test_second_profile_refused(client_as, account, manager):
        first = await client_as(hr_admin).post("/employees", json=payload)
        second = await client_as(hr_admin).post("/employees", json=payload)
        assert second.status_code == 409
        assert second.json()["existing_employee_id"] == first.json()["id"]
        assert session.scalar(select(func.count()).select_from(Employee)) == 1
    ```
    and a model test that inserting two rows with the same `(organisation_id, account_id)` raises `IntegrityError` (the database backstop).
  - |
    AC3 - parametrised over the four HR-owned fields:
    ```python
    @pytest.mark.parametrize("field,value", [("name", "Amara N. Okafor"), ("job_title", "Finance lead"),
                                             ("department", "Sales"), ("manager_id", str(other_manager.id))])
    async def test_hr_changes_one_work_field(client_as, employee, field, value):
        body = {**work_payload(employee), field: value}
        resp = await client_as(hr_admin).patch(f"/employees/{employee.id}/work", json=body)
        assert resp.status_code == 200
        shown = (await client_as(hr_admin).get(f"/employees/{employee.id}")).json()
        assert shown[field] == value
    ```
    Web (`EmployeeProfilePage.test.tsx`, vitest + Testing Library, `fetch` stubbed): HR clicks "Edit work details", changes Job title, clicks "Save work details", and `expect(await screen.findByText('Finance lead')).toBeInTheDocument()` plus the toast `Work details saved.`; clearing Full name shows `Enter the employee's full name.` and does not call `fetch` with PATCH.
  - |
    AC4 - API and web:
    ```python
    async def test_employee_edits_own_personal_details(client_as, employee):
        resp = await client_as(as_employee(employee)).patch(f"/employees/{employee.id}/personal", json={
            "personal_phone": "+44 7700 900999", "home_address": "1 New Road\nLeeds",
            "emergency_contact_name": "Tobias (brother)", "emergency_contact_phone": "+44 7700 900456"})
        assert resp.status_code == 200
        assert resp.json()["personal"]["personal_phone"] == "+44 7700 900999"
    ```
    Web: own view, "Edit contact details", change phone, "Save contact details", `expect(await screen.findByText('+44 7700 900999')).toBeInTheDocument()`.
  - |
    AC5 - API: `PATCH /employees/{id}/work` as the employee returns 403 and the name is unchanged; `PATCH /employees/{id}/personal` with `{"name": "X", ...}` returns 422 (`extra='forbid'`); the own-view JSON has `viewer == {"can_edit_work": False, "can_edit_personal": True, "can_mark_leaver": False}`. Web:
    ```tsx
    expect(screen.getByText('Senior accountant')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit work details' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Full name' })).not.toBeInTheDocument()
    ```
  - |
    AC6 - API and web:
    ```python
    async def test_hr_marks_leaver(client_as, employee):
        resp = await client_as(hr_admin).post(f"/employees/{employee.id}/leaver")
        assert resp.status_code == 200 and resp.json()["status"] == "inactive"
    async def test_marking_leaver_twice_is_409(...): assert second.status_code == 409
    async def test_non_hr_cannot_mark_leaver(...): assert resp.status_code == 403
    ```
    Web: click "Mark as leaver", the dialog `Mark Amara Okafor as a leaver?` appears, click the dialog's "Mark as leaver", then `expect(await screen.findByText('Inactive')).toBeInTheDocument()` and no "Edit work details" button; clicking "Keep as active" sends no POST.
  - |
    AC7 - `async def test_hr_admin_sees_leaver(client_as, leaver): resp = await client_as(hr_admin).get(f"/employees/{leaver.id}"); assert resp.status_code == 200; assert resp.json()["status"] == "inactive"`. Web: HR view of an inactive record shows the `Inactive leaver. Only HR admins can see this record. It is read-only.` alert and no edit buttons.
  - |
    AC8 - `async def test_non_hr_cannot_see_leaver(client_as, leaver): for who in (manager_principal, other_employee, as_employee(leaver)): resp = await client_as(who).get(f"/employees/{leaver.id}"); assert resp.status_code == 404`. Also a cross-organisation test: an HR admin of another organisation gets 404 for an active record. Web: a 404 response renders `expect(screen.getByRole('heading', { name: "This profile isn't available" })).toBeInTheDocument()` and no name, phone or address text.
  - |
    AC9 - API: `body = (await client_as(manager_principal).get(f"/employees/{employee.id}")).json(); assert "personal" not in body; raw = json.dumps(body); assert employee.personal_phone not in raw and employee.home_address not in raw and employee.emergency_contact_name not in raw` (the values are absent from the payload, not just hidden). Service test `to_view` returns `EmployeeWorkView` for a non-owner non-HR principal. Web: `expect(screen.getByText(/Not shown\. Only Amara and HR admins can see these\./)).toBeInTheDocument()` and `expect(screen.queryByText('+44 7700 900123')).not.toBeInTheDocument()`.
  - |
    AC10 - `body = (await client_as(hr_admin).get(f"/employees/{employee.id}")).json(); assert body["personal"] == {"personal_phone": "+44 7700 900123", "home_address": "14 Alder Court\nLeeds LS6 2AB", "emergency_contact_name": "Tobias Okafor (brother)", "emergency_contact_phone": "+44 7700 900456"}`. Web: HR view shows the phone, address and emergency contact, the badge `Edited by the employee`, and no "Edit contact details" button; `PATCH .../personal` as HR returns 403.
  - |
    AC11 - the leaver cannot change their details; the record is unchanged afterwards:
    ```python
    async def test_leaver_cannot_edit_personal(client_as, leaver):
        resp = await client_as(as_employee(leaver)).patch(f"/employees/{leaver.id}/personal", json=personal_payload)
        assert resp.status_code in (403, 404)
        session.refresh(leaver)
        assert leaver.personal_phone == original_phone
    ```
    The status is 404 because AC8 hides the record from the leaver; flagged in the open questions. Web: no test for an editable form on an inactive record because the API never returns one to a non-HR viewer.
  - |
    Migration - `test_migration_creates_tables_and_constraints`: run `alembic upgrade head` against a temp SQLite URL (`command.upgrade(cfg, "head")`), assert `inspect(engine).get_table_names()` contains `employees` and `accounts`, that every tenant table has an `organisation_id` column, and that duplicate `(organisation_id, account_id)` raises `IntegrityError`; then `command.downgrade(cfg, "base")` removes both tables. No existing rows exist to read back (first migration of the project).
  - |
    Web foundations - `src/shell/AppShell.test.tsx`: `expect(screen.getByRole('link', { name: 'Items' })).toHaveAttribute('aria-current', 'page')` on an employee route; `Drawer.test.tsx`: Escape closes it and focus returns to the opener; `CreateEmployeePage.test.tsx`: submitting with no employee shows `Choose an employee to continue.`; success shows `Profile created for Lucía Fernández.`; a stubbed 409 shows `already has a profile` and an "Open existing profile" link whose `href` ends in the `existing_employee_id`. Narrow commands: `(cd services/api && uv run pytest tests/unit/test_employees_api.py tests/unit/test_employees_service.py tests/unit/test_migration.py)` and `(cd apps/web && pnpm test src/features/employees src/shell src/components)`.

assumptions_or_open_questions:
  - |
    AC8 and AC11 conflict. AC8 says any user other than an HR admin cannot view an inactive record, which includes the leaver; AC11 describes the leaver viewing their own record and being unable to edit it, and the approved design has an "own-leaver" state showing a read-only record. The plan follows AC8 (stricter, privacy-safe): the leaver gets 404 on view and on edit, so AC11 holds because the edit is refused, and the design's own-leaver screen is not built. If the leaver should see a read-only copy of their own record, AC8 must say so and the rule in `get_visible_employee` changes.
  - |
    Authentication does not exist in this repo (searched `services/api` for cognito, jwt, organisation_id: no matches; app files re-listed this session). ADR-0004 requires Cognito-issued tokens and verifying them calls the Cognito JWKS endpoint, which ADR-0010 says must be recorded as an integration first. This plan adds only the `Principal` seam (claims needed: account id, organisation id, `hr_admin` group), fails closed with 401, and tests via dependency override, so the feature cannot be used for real until a sign-in / token verification story lands. Who owns that, and the exact claim names, need a decision. The Web App seam is `src/auth/token.ts`.
  - |
    Where do `accounts` rows come from? The design's "Employee" select lists sign-in accounts without a profile. The plan adds a minimal `accounts` table in the Core API and nothing populates it (Cognito sync/provisioning is not in this story). Alternatives: a Cognito user-list integration (needs ADR-0010 recording) or HR typing the account email. Needs a decision before real use; tests insert rows directly.
  - |
    Department source. The epic has job/department/manager structure and structure history as separate stories, so no department list exists. This plan stores department as text and offers existing values through a datalist instead of the prototype's select. If a department table is coming, swap the field to a foreign key then. Manager is a required choice among active employees of the organisation (`manager_id`), as the create form's "Choose a manager." error implies; the very first profile in an organisation therefore cannot be created until a manager exists. Is a first-employee exemption (nullable manager) wanted?
  - |
    Prototype elements not built because no AC, input or column backs them: Employee ID and Start date rows on the profile, and a directory (Back to directory / Search the directory link to the Items root until the directory story). Work email shows the account's email.
  - |
    Assumed from the design and AC wording: any signed-in member of the same organisation may view an ACTIVE profile's work details (the manager note says "you can see work details for your team", AC9 only hides the personal block); HR admins cannot edit a leaver's work details either (record is read-only per the design); HR cannot edit the employee's personal details (design: "Edited by the employee"); an employee cannot be their own manager; personal fields must all be filled on save, as in the design.
  - |
    Deferred project-wide questions this story does not settle: retention of employee records after someone leaves, and whether changes are audit-logged. Nothing here deletes records or writes an audit trail, since no AC asks for either; marking a leaver keeps the row indefinitely. Scale question: ADR-0006 already says 10,000 registered users and 100 concurrent users, which a single indexed `employees` table in PostgreSQL serves comfortably.
  - |
    Two new packages are added: `alembic` (Core API, migrations; the project has none) and `react-router-dom` (Web App, routing; none exists). No test-only packages are added: Testing Library `fireEvent` is used instead of `user-event`.
  - |
    Design-system defect: `apps/web/design/tokens.css` lines 70-72 set `--duration-fast`, `--duration-spin` and `--duration-pulse` to `[object Object]`, which is invalid CSS, so transitions and the skeleton and spinner animations will not run. This plan uses the tokens by name anyway and does not hand-edit the generated file or add a literal duration; the token build needs fixing separately.
  - |
    A `size-container` of 1120px and the 48rem / 40rem breakpoints are used as in the prototype; no token covers a breakpoint width, so those two media-query values stay literal. `.kv` label column width (11rem) has no token; keep it as the prototype's rem value inside `employees.css`.

estimated_points: 8

package_dependencies:
  - name: alembic
    version: ">=1.13,<2"
    ecosystem: pip
    component_id: comp_core_api
    rationale: The Core API has no migration tooling; the new employees and accounts tables need a reviewable, reversible PostgreSQL migration.
  - name: react-router-dom
    version: "^7.0.0"
    ecosystem: npm
    component_id: comp_web_app
    rationale: The Web App has no routing; the profile and create-profile screens need URLs (/employees/:employeeId, /employees/new).

notes: |
  ### Data & rollout
  - **Existing data**: None to migrate - migration `0001_employees` is the project's first; it creates `accounts` and `employees` as new tables, so no existing row is altered. Unique `(organisation_id, account_id)` and the `status` check apply only to new rows.
  - **Backfill / seed**: No backfill. `accounts` must be populated before HR can create anyone (open question above); the epic's one-time spreadsheet import is a separate story. Nothing in this plan seeds data.
  - **Settings**: `API_CORS_ORIGINS` (list, default `["http://localhost:5173"]`, safe when unset; defined in `services/api/app/config.py`, same `API_` prefix as `API_DATABASE_URL`). Web App `VITE_API_BASE_URL` (default `http://localhost:8000`). Document both in the PR description; no `.env*` file is read or edited.
  - **Provisioning**: PostgreSQL reachable at `API_DATABASE_URL`; a Cognito `hr_admin` group and organisation-id claim for tokens, plus the token verifier (not in this story).
  - **Order and rollback**: run `cd services/api && uv run alembic upgrade head` before starting the new API version; roll back with `uv run alembic downgrade base` (drops the two new tables; safe because nothing else references them yet) - the Web App can be reverted independently since it only calls the new routes.

  ### Design reading
  The prototype (`TESTING-20-NOV-STORY-022-design.html`) has two screens: "Employee profile" with states default (HR), own, manager, hr-leaver, own-leaver, leaver-hidden, loading, error, and "Create employee profile" with default, duplicate, success. It styles only with the tokens in `apps/web/design/tokens.css` and the classes in `apps/web/design/prototype-utils.css`, plus feature-local `.kv`, `.page-head`, `.who`, `.card-head`, `.backlink`, `.narrow`, `.drawer-head`, `.dd-actions`, `.skel-row` and the shell rules, which the plan re-creates on tokens. The design is light only and uses sentence-case verb-plus-object buttons, one `.btn-primary` per view, `.btn-danger` only in the leaver confirmation, a drawer for editing and a modal for confirming, as the UI guidelines require. Note `apps/web/design/tokens.css` lines 70-72 define `--duration-fast`, `--duration-spin` and `--duration-pulse` as the invalid value `[object Object]` (a token-build defect), so transitions and the skeleton/spinner animations using them are ignored by the browser. Do not edit the generated token file in this story; the components degrade to no animation, and the defect is listed in the open questions.

  ### Prior history
  The path history for these files shows one earlier commit, c12c65d (scaffold, PR #7), which created the web and API skeletons this plan extends; nothing else has touched them, so there are no earlier decisions to preserve.

  ### Structure
  ```mermaid
  flowchart TD
    main[app/main.py] --> emp_router[routers/employees.py]
    main --> health[routers/health.py]
    emp_router --> svc[services/employees.py]
    emp_router --> auth[auth.py Principal]
    svc --> models[models.py]
    models --> mig[migrations/0001_employees.py]
    emp_router --> db[db.py get_session]
    db --> cfg[config.py]
    web_main[web main.tsx] --> app[App.tsx routes]
    web_main --> css[index.css]
    css --> tokens[design/tokens.css]
    css --> utils[design/prototype-utils.css]
    app --> shell[shell/AppShell.tsx]
    app --> profile[EmployeeProfilePage.tsx]
    app --> create[CreateEmployeePage.tsx]
    profile --> api[api/employees.ts]
    create --> api
    api -->|HTTP| emp_router
    classDef touched fill:#f96,color:#000
    class main,emp_router,svc,auth,models,mig,db,cfg,web_main,app,css,shell,profile,create,api touched
  ```
  Orange nodes are created or modified by this plan; `health.py`, `tokens.css` and `prototype-utils.css` are existing context.

review_focus: |
  IN: employee profile create/view/edit/leaver in the Core API and the two approved screens; OUT: directory, structure history, documents, import, audit log, retention, Cognito token verification and account provisioning (seams and open questions only). Riskiest area is `services/employees.py`: personal fields must be absent from the payload for anyone but the employee and HR admins, inactive records must 404 for non-HR (including the leaver), and every query must filter by `organisation_id`. Deliberate decisions: AC8 wins over AC11 and the design's own-leaver state; department is a datalist input, not a select; `get_principal` fails closed until the auth story lands; prototype Employee ID and Start date rows are not built.
