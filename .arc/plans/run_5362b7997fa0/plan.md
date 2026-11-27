summary: |
  Build the HR employee record end to end. The Core API gets a PostgreSQL-backed `employees` table (plus a minimal `accounts` table HR picks the employee from) and endpoints to create a profile (one per employee), view it, edit HR-owned work details (name, job title, department, manager), edit employee-owned personal details (phone, home address, emergency contact) and mark a leaver inactive. All visibility and edit rules live in one server-side module so personal fields are never sent to anyone but the employee and HR admins, and inactive records are 404 for everyone but HR admins. The Web App gets the approved Employee profile screen (work-details and personal-contact cards, edit drawers, leaver confirm modal, loading/error/not-available states) and the Create employee profile screen, on the design-system tokens and component classes. The repo today has no auth, no migrations, no router and no shell (checked: services/api/app holds only config, db, main, routers/health; apps/web/src holds only App, main, index.css, test-setup), so the plan adds the thin seams this story needs and flags what belongs to other stories.

scope:
  - description: |
      Add Alembic and migration 0001 creating `accounts` and `employees`, both carrying `organisation_id` (ADR-0009).
      `accounts(id uuid pk, organisation_id uuid not null, email text not null, display_name text not null, unique(organisation_id, email))` is the Core API's local list of sign-in accounts HR can pick from.
      `employees(id uuid pk, organisation_id uuid not null, account_id uuid not null fk accounts.id, name text not null, job_title text not null, department text not null, manager_id uuid null fk employees.id, personal_phone text null, home_address text null, emergency_contact_name text null, emergency_contact_phone text null, status text not null default 'active' check in ('active','inactive'), created_at, updated_at, unique(organisation_id, account_id))`.
      The unique constraint is the database backstop for AC2; the service checks first so it can return a clear 409. Use portable types (`sa.Uuid`, `sa.Text`, `sa.DateTime(timezone=True)`) so the migration also runs on SQLite in unit tests. Add an index on `(organisation_id, status)`.
    files:
      - services/api/pyproject.toml
      - services/api/alembic.ini
      - services/api/migrations/env.py
      - services/api/migrations/versions/0001_employees.py
      - services/api/app/models.py
    rationale: |
      No schema or migration tooling exists. ADR-0003 and ADR-0009 require the data in PostgreSQL, tenant-scoped.
  - description: |
      Add the request principal seam in `app/auth.py` and a session dependency in `app/db.py`.
      ```python
      @dataclass(frozen=True)
      class Principal:
          account_id: UUID
          organisation_id: UUID
          is_hr_admin: bool

      def get_principal(request: Request) -> Principal: ...   # fail-closed: 401 until a verifier is configured
      ```
      `get_principal` is the single place the rest of the code learns who is calling. ADR-0004 says only Cognito-issued tokens are accepted; verifying them needs a Cognito JWKS fetch, which ADR-0010 says must be recorded as an integration first. This story delivers the dependency, the `Principal` shape (claims: account id, organisation id, `hr_admin` group) and a default that returns 401; tests override it.
      In `app/db.py` add `get_session() -> Iterator[Session]` using a lazily created `sessionmaker(make_engine())`. In `app/config.py` add `cors_origins: list[str] = ["http://localhost:5173"]` (env `API_CORS_ORIGINS`) and register `CORSMiddleware` in `app/main.py` so the Web App can call the API.
    files:
      - services/api/app/auth.py
      - services/api/app/db.py
      - services/api/app/config.py
      - services/api/app/main.py
    rationale: |
      ADR-0002 and ADR-0004: the Core API authorises every request against the caller; every service function takes a Principal and filters by its organisation.
  - description: |
      Permissions and domain rules in `app/services/employees.py` (session-based, no HTTP types) with errors `EmployeeNotFound`, `NotPermitted`, `DuplicateProfile(existing_employee_id)`, `InvalidReference`, `AlreadyInactive`.
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
      - `get_visible_employee`: an HR admin sees any record; anyone else sees only `status == 'active'`; an inactive record raises `EmployeeNotFound` for them (404, existence not leaked), including the leaver (AC7, AC8; see the AC8 vs AC11 question).
      - `to_view`: the personal block (phone, home address, emergency contact name and phone) is included only when the viewer is the employee (`principal.account_id == employee.account_id`) or an HR admin; otherwise the model is `EmployeeWorkView`, which has no `personal` key at all (AC9, AC11). The view carries `viewer: {can_edit_work, can_edit_personal, can_mark_leaver}` computed from the same rules so the UI never re-implements them.
      - `create_employee`: HR admin only; the account must belong to the caller's organisation and the manager (required) must be an active employee in it, else `InvalidReference`; an existing `(organisation_id, account_id)` raises `DuplicateProfile` and inserts nothing; also catch `IntegrityError` (race) and raise the same error (AC1, AC2).
      - `update_work_details`: HR admin only, active record only; changes name, job_title, department, manager_id; a manager cannot be the employee themselves (AC3, AC5, AC12).
      - `update_personal_details`: only the employee, only while active; HR admins and managers get `NotPermitted`; a leaver gets `EmployeeNotFound` (AC4, AC10). Work fields are not in `PersonalDetailsUpdate`, and `extra='forbid'` rejects a body carrying `name` (AC5).
      - `mark_leaver`: HR admin only; active to inactive; already inactive raises `AlreadyInactive` (409) and changes nothing (AC6). Reactivation is not built.
    files:
      - services/api/app/services/__init__.py
      - services/api/app/services/employees.py
      - services/api/app/schemas.py
    rationale: |
      Keeps the privacy rules in one testable place independent of FastAPI, so the router is thin and cannot drift from the rules.
  - description: |
      HTTP surface in `app/routers/employees.py`, registered in `app/main.py`. Error mapping: `EmployeeNotFound` 404, `NotPermitted` 403, `DuplicateProfile` 409 with body `{"detail": "...", "existing_employee_id": "<uuid>"}`, `InvalidReference` 422, `AlreadyInactive` 409. Routes return model instances with `response_model=None` so the `personal` key is genuinely absent for non-owners:
      - `POST /employees` (HR) -> 201 `EmployeeFullView`
      - `GET /employees/me` -> caller's own profile (404 if none); declared before `/{employee_id}`
      - `GET /employees/options` (HR) -> `{accounts: [{id, name, email, has_profile}], departments: [str], managers: [{id, name}]}`
      - `GET /employees/{employee_id}`
      - `PATCH /employees/{employee_id}/work` (HR)
      - `PATCH /employees/{employee_id}/personal` (the employee)
      - `POST /employees/{employee_id}/leaver` (HR)
      Pydantic validation: name, job title, department non-blank after strip; the four personal fields non-blank on save (the design's drawer requires all four); lengths capped (name/title/department 200, phone 40, address 1000).
    files:
      - services/api/app/routers/employees.py
      - services/api/app/main.py
    rationale: |
      Only the Core API reads or writes the database (ADR-0002); the Web App reaches data only through it (ADR-0001).
  - description: |
      Web App foundations. (1) Load the design system once in `apps/web/src/index.css` after `@import "tailwindcss";` (line 1 today, the only line): `@import "../design/tokens.css";` and `@import "../design/prototype-utils.css";`. (2) Add `react-router-dom` and a router in `main.tsx`/`App.tsx` with routes `/employees/new`, `/employees/me` (redirects to own profile id) and `/employees/:employeeId`. (3) `src/api/client.ts`: a `fetch` wrapper reading `import.meta.env.VITE_API_BASE_URL` (default `http://localhost:8000`), attaching the bearer token from `src/auth/token.ts` (`getAccessToken(): string | null`, the one seam the sign-in story replaces); throws `ApiError {status, body}`. (4) `src/api/employees.ts`: typed functions mirroring the endpoints and the `EmployeeWorkView | EmployeeFullView` types.
    files:
      - apps/web/src/index.css
      - apps/web/src/main.tsx
      - apps/web/src/App.tsx
      - apps/web/src/api/client.ts
      - apps/web/src/api/employees.ts
      - apps/web/src/auth/token.ts
      - apps/web/package.json
    rationale: |
      The design's classes only exist once the stylesheets are imported; nothing loads tokens today.
  - description: |
      App shell and shared overlays, matching the prototype's shell markup. `src/shell/AppShell.tsx`: top bar (brand, "Menu" button below 48rem, nav links Overview, Items, Reports, Settings with `data-nav-key`, Account at the right with `data-nav-key="account"`), `<main id="content">` in a `size-container` column, footer; Items has `aria-current="page"` on every employee screen. The shell rules, `.kv`, `.page-head`, `.who`, `.card-head`, `.backlink`, `.narrow`, `.drawer-head`, `.dd-actions`, `.skel-*` and avatar-header rules are not defined in `prototype-utils.css` (shell rules exist only in `design/app-shell.html`, the rest in the prototype's inline style), so define them in `src/shell/shell.css` and `src/features/employees/employees.css` using only tokens: `--space-2/3/4`, `--size-tap`, `--size-container`, `--size-icon`, `--font-size-sm/lg/xl`, `--color-fg-muted`, `--color-info-bg`, `--color-info`, `--color-primary`, `--color-border`, `--radius-md`, `--duration-fast`, `--line-height-tight`. The 48rem and 40rem media-query widths stay literal (media queries cannot read tokens). Before writing the CSS, re-open tokens.css and the prototype and confirm each token name exists.
      Components: `src/components/Drawer.tsx` (role="dialog", aria-modal, labelled by title, focus moves in, Tab trapped, Escape and backdrop close, focus returns to trigger), `src/components/ConfirmModal.tsx` (same behaviour, `.modal`), `src/components/Toast.tsx` (`role="status"`, auto-hide 4 s, `.toast`).
    files:
      - apps/web/src/shell/AppShell.tsx
      - apps/web/src/shell/shell.css
      - apps/web/src/components/Drawer.tsx
      - apps/web/src/components/ConfirmModal.tsx
      - apps/web/src/components/Toast.tsx
      - apps/web/src/features/employees/employees.css
    rationale: |
      UI guidelines: top bar only, Menu collapse below 48rem, each screen marks its section, drawer for editing a record, modal only for confirmations, toast for completed actions.
  - description: |
      Employee profile screen `EmployeeProfilePage.tsx` (route `/employees/:employeeId`), from the prototype's "Employee profile" screen.
      - Header (`.page-head`): `.avatar` initials, `h1` name, `.badge-success` "Active" or `.badge-neutral` "Inactive", then "job title, department" in `.text-muted`. Actions only when `viewer.can_edit_work`: one `.btn-primary` "Edit work details", `.btn-secondary` "Mark as leaver", `.btn-ghost` "Add employee" linking to `/employees/new`. "Back to directory" is a `.backlink` to the Items root (directory is a separate story).
      - "Work details" `.card` with `.kv`: Name, Job title, Department, Manager (name from the API), Work email (account email); badge "Edited by HR" for HR, "Managed by HR" otherwise (AC5). Prototype Employee ID and Start date rows are not built (no AC, input or column).
      - "Personal contact details" `.card`: with `personal` present show phone, home address (line breaks kept), emergency contact (name and phone), plus badge "Edited by the employee" for HR or an "Edit contact details" `.btn-primary` for the employee; when absent show "Not shown. Only {first name} and HR admins can see these." (AC11). `.alert-info` note above the cards for the employee and for a manager, as in the prototype.
      - Edit work details `Drawer` (Full name, Job title, Department, Manager, `.btn-primary` "Save work details", `.btn-secondary` "Cancel"); Edit contact details `Drawer` (Personal phone, Home address textarea, Emergency contact name with relationship hint, Emergency contact phone; "Save contact details"). Every control in a `.field` with `.field-label`; blank values show `.field-error` and `.is-invalid` with `aria-invalid`, using the prototype's messages. Save shows "Saving…", closes the drawer, updates from the response and toasts "Work details saved." / "Contact details saved.". A 403/409/422 shows `.alert-danger` inside the drawer and keeps it open.
      - Leaver `ConfirmModal` "Mark {name} as a leaver?" with `.btn-secondary` "Keep as active" and `.btn-danger` "Mark as leaver"; on success the badge becomes "Inactive", actions disappear, `.alert-warning` "Inactive leaver. Only HR admins can see this record. It is read-only." shows, toast "{name} is marked as a leaver." (AC6, AC7).
      - States: loading = `.card` of `.skeleton` lines with `aria-busy="true"`; 404 = `.empty-state` "This profile isn't available" with a `.btn-primary` "Search the directory" (Items root until the directory story) (AC8); other failures = `.alert-danger` "We couldn't load this profile." with `.btn-secondary` "Try again".
    files:
      - apps/web/src/features/employees/EmployeeProfilePage.tsx
      - apps/web/src/features/employees/WorkDetailsDrawer.tsx
      - apps/web/src/features/employees/PersonalDetailsDrawer.tsx
      - apps/web/src/features/employees/useEmployee.ts
      - apps/web/src/features/employees/validation.ts
    rationale: |
      One screen rendered from the server's `viewer` capabilities and the presence of `personal`, so the browser never decides who may see what.
  - description: |
      Create employee profile screen `CreateEmployeePage.tsx` (route `/employees/new`, HR only; a non-HR caller sees the not-available empty state because `GET /employees/options` returns 403): `.narrow` column, `h1` "Create employee profile", `.alert-info` "Each employee has one profile...", one `.card` `form` with Employee (`select` from `options.accounts`, accounts with a profile marked "(profile exists)"; choosing one prefills Full name), Full name, Job title, Department, Manager in a `.grid`, `.btn-primary` "Create profile" ("Creating…" while pending), `.btn-ghost` "Cancel". Prototype error messages ("Choose an employee to continue.", "Enter a job title, for example Payroll analyst."). Success: `.alert-success` "Profile created for {name}." with `.btn-secondary` "Open profile" (AC1). A 409: `.alert-danger` "{name} already has a profile. No second profile was created..." with `.btn-secondary` "Open existing profile" linking to `existing_employee_id` (AC2). Department is an `input` with a `datalist` of `options.departments` instead of the prototype's `select` (no department list exists); deliberate deviation.
    files:
      - apps/web/src/features/employees/CreateEmployeePage.tsx
    rationale: |
      AC1 and AC2 need a screen; the prototype shows default, duplicate and success states.

tests:
  - |
    AC1 - API unit test `services/api/tests/unit/test_employees_api.py` (httpx ASGITransport, in-memory SQLite, `app.dependency_overrides[get_principal]`), written first, failing with 404 (route missing):
    ```python
    async def test_hr_admin_creates_profile(client_as, account, manager):
        resp = await client_as(hr_admin).post("/employees", json=payload)
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Lucia Fernandez" and body["status"] == "active"
        assert body["personal"]["personal_phone"] is None
    async def test_non_hr_cannot_create(client_as, account, manager):
        resp = await client_as(plain_employee).post("/employees", json=payload)
        assert resp.status_code == 403
    ```
    Plus service test `test_create_rejects_account_from_other_organisation` asserting `pytest.raises(InvalidReference)`.
  - |
    AC2 - service and API:
    ```python
    async def test_second_profile_refused(client_as, session, account, manager):
        first = await client_as(hr_admin).post("/employees", json=payload)
        second = await client_as(hr_admin).post("/employees", json=payload)
        assert second.status_code == 409
        assert second.json()["existing_employee_id"] == first.json()["id"]
        assert session.scalar(select(func.count()).select_from(Employee)) == 1
    ```
    and a model test that two rows with the same `(organisation_id, account_id)` raise `IntegrityError`.
  - |
    AC3 - parametrised over the four HR-owned fields:
    ```python
    @pytest.mark.parametrize("field,value", [("name", "Amara N. Okafor"), ("job_title", "Finance lead"),
                                             ("department", "Sales"), ("manager_id", str(other_manager.id))])
    async def test_hr_changes_one_work_field(client_as, employee, field, value):
        resp = await client_as(hr_admin).patch(f"/employees/{employee.id}/work", json={**work_payload(employee), field: value})
        assert resp.status_code == 200
        shown = (await client_as(hr_admin).get(f"/employees/{employee.id}")).json()
        assert shown[field] == value
    ```
    Web `EmployeeProfilePage.test.tsx` (vitest, Testing Library, `fetch` stubbed): HR clicks "Edit work details", changes Job title, clicks "Save work details", then `expect(await screen.findByText('Finance lead')).toBeInTheDocument()` and the toast `Work details saved.`; clearing Full name shows `Enter the employee's full name.` and no PATCH is sent.
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
    AC5 - API: `PATCH /employees/{id}/work` as the employee returns 403 and the name is unchanged; `PATCH .../personal` with `{"name": "X", ...}` returns 422; own-view JSON has `viewer == {"can_edit_work": False, "can_edit_personal": True, "can_mark_leaver": False}`. Web:
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
    Web: click "Mark as leaver", dialog `Mark Amara Okafor as a leaver?` appears, confirm, then `expect(await screen.findByText('Inactive')).toBeInTheDocument()` and no "Edit work details" button; "Keep as active" sends no POST.
  - |
    AC7 - `async def test_hr_admin_sees_leaver(client_as, leaver): resp = await client_as(hr_admin).get(f"/employees/{leaver.id}"); assert resp.status_code == 200; assert resp.json()["status"] == "inactive"`. Web: HR view of an inactive record shows `Inactive leaver. Only HR admins can see this record. It is read-only.` and no edit buttons.
  - |
    AC8 - `async def test_non_hr_cannot_see_leaver(client_as, leaver): for who in (manager_principal, other_employee, as_employee(leaver)): assert (await client_as(who).get(f"/employees/{leaver.id}")).status_code == 404`. Plus cross-organisation: an HR admin of another organisation gets 404 for an active record. Web: 404 renders `expect(screen.getByRole('heading', { name: "This profile isn't available" })).toBeInTheDocument()` and no name, phone or address text.
  - |
    AC9 - HR sees the personal block:
    ```python
    body = (await client_as(hr_admin).get(f"/employees/{employee.id}")).json()
    assert body["personal"] == {"personal_phone": "+44 7700 900123", "home_address": "14 Alder Court\nLeeds LS6 2AB",
                                "emergency_contact_name": "Tobias Okafor (brother)", "emergency_contact_phone": "+44 7700 900456"}
    ```
    Web: HR view shows phone, address and emergency contact, badge `Edited by the employee`, no "Edit contact details" button.
  - |
    AC10 - the leaver cannot change their details and the record is unchanged:
    ```python
    async def test_leaver_cannot_edit_personal(client_as, session, leaver):
        resp = await client_as(as_employee(leaver)).patch(f"/employees/{leaver.id}/personal", json=personal_payload)
        assert resp.status_code in (403, 404)
        session.refresh(leaver)
        assert leaver.personal_phone == original_phone
    ```
    Status is 404 because AC8 hides the record from the leaver (see open questions). `PATCH .../personal` as HR returns 403.
  - |
    AC11 - values absent from the payload, not just hidden:
    ```python
    body = (await client_as(manager_principal).get(f"/employees/{employee.id}")).json()
    assert "personal" not in body
    raw = json.dumps(body)
    assert employee.personal_phone not in raw and employee.home_address not in raw and employee.emergency_contact_name not in raw
    ```
    Service test: `to_view` returns `EmployeeWorkView` for a non-owner non-HR principal. Web: `expect(screen.getByText(/Not shown\. Only Amara and HR admins can see these\./)).toBeInTheDocument()` and `expect(screen.queryByText('+44 7700 900123')).not.toBeInTheDocument()`.
  - |
    AC12 - HR cannot edit a leaver:
    ```python
    async def test_hr_cannot_edit_leaver(client_as, session, leaver):
        w = await client_as(hr_admin).patch(f"/employees/{leaver.id}/work", json=work_payload(leaver))
        p = await client_as(hr_admin).patch(f"/employees/{leaver.id}/personal", json=personal_payload)
        assert w.status_code in (403, 409) and p.status_code == 403
        session.refresh(leaver)
        assert leaver.name == original_name and leaver.personal_phone == original_phone
    ```
    Web: HR view of a leaver has no edit buttons (covered in the AC7 test).
  - |
    Migration - `services/api/tests/unit/test_migration.py::test_migration_creates_tables_and_constraints`: `command.upgrade(cfg, "head")` against a temp SQLite URL; assert `inspect(engine).get_table_names()` contains `employees` and `accounts`, that each has an `organisation_id` column, and that a duplicate `(organisation_id, account_id)` raises `IntegrityError`; `command.downgrade(cfg, "base")` removes both. No existing rows exist (first migration).
  - |
    Web foundations - `AppShell.test.tsx`: `expect(screen.getByRole('link', { name: 'Items' })).toHaveAttribute('aria-current', 'page')` on an employee route; `Drawer.test.tsx`: Escape closes it and focus returns to the opener; `CreateEmployeePage.test.tsx`: submit with no employee shows `Choose an employee to continue.`, success shows `Profile created for Lucía Fernández.`, a stubbed 409 shows `already has a profile` and an "Open existing profile" link whose href ends in `existing_employee_id`. Narrow commands: `(cd services/api && uv run pytest tests/unit/test_employees_api.py tests/unit/test_employees_service.py tests/unit/test_migration.py)` and `(cd apps/web && pnpm test src/features/employees src/shell src/components)`.

assumptions_or_open_questions:
  - |
    AC8 and AC10/AC11 pull against each other. AC8 says any user other than an HR admin cannot view an inactive record, which includes the leaver; the AC about the leaver "viewing their own record" and the approved design's "own-leaver" state show a read-only record. The plan follows AC8 (stricter): the leaver gets 404 on view and edit, so the edit is refused, and the design's own-leaver screen is not built. If leavers should see a read-only copy of their own record, AC8 must say so.
  - |
    Authentication does not exist (searched services/api: only config, db, main, health router). ADR-0004 requires Cognito tokens and verifying them calls the JWKS endpoint, which ADR-0010 says must be recorded as an integration first. The plan adds only the `Principal` seam (account id, organisation id, `hr_admin` group claims), fails closed with 401 and tests by dependency override, so the feature cannot be used for real until a token-verification story lands. Who owns that and the exact claim names need a decision.
  - |
    Where do `accounts` rows come from? Nothing populates the new table (Cognito provisioning is out of scope). Alternatives are a Cognito user-list integration (needs ADR-0010 recording) or HR typing an email. Needs a decision before real use.
  - |
    Department source: no department list exists (structure is a separate story), so department is text with a datalist of existing values. Manager is required among active employees, so the first profile in an organisation cannot be created. Is a first-employee exemption (nullable manager) wanted?
  - |
    Assumed from the design and AC wording: any signed-in member of the same organisation may view an ACTIVE profile's work details; HR admins cannot edit a leaver's work details; HR cannot edit an employee's personal details; an employee cannot be their own manager; all four personal fields are required on save.
  - |
    Deferred project-wide questions not settled here: retention of employee records after someone leaves, and whether changes are audit-logged. Nothing deletes records or writes an audit trail, since no AC asks for either; a leaver's row is kept indefinitely. ADR-0006 (10,000 users, 100 concurrent) is served by a single indexed table.
  - |
    Design-system defect: `apps/web/design/tokens.css` lines 70-72 set `--duration-fast`, `--duration-spin`, `--duration-pulse` to `[object Object]` (invalid CSS), so transitions and skeleton/spinner animation will not run. The plan uses the tokens by name and does not hand-edit the generated file; the token build needs fixing separately.
  - |
    No token covers breakpoints (48rem, 40rem) or the `.kv` label column width (11rem); these stay as the prototype's literal values in the CSS.

decisions:
  - decision: Enforce visibility and edit rules server-side in one `capabilities`/`to_view` module, omitting the personal block from the payload for non-owner non-HR viewers.
    rationale: Privacy of personal fields must not depend on the browser hiding data; one place keeps the router and UI from drifting.
    alternatives:
      - Return all fields and hide in the UI
      - Check roles inside each route
    durable: true
    evidence:
      - services/api/app/services/employees.py
    scope: api
    status: follows
    follows_adr:
      - ADR-0002
  - decision: Return 404 for an inactive record to every viewer except an HR admin, the leaver included.
    rationale: AC8 is explicit and 404 avoids leaking existence.
    alternatives:
      - Let the leaver see a read-only copy (the design's own-leaver state)
    durable: false
    evidence: []
    scope: api
    status: proposed
  - decision: Add a `Principal` dependency that fails closed with 401 until a Cognito verifier exists.
    rationale: ADR-0004 and ADR-0010 block wiring real token verification in this story without a recorded integration.
    alternatives:
      - Verify Cognito JWTs now
      - Trust an unsigned header
    durable: true
    evidence:
      - services/api/app/auth.py
    scope: api
    status: follows
    follows_adr:
      - ADR-0004
      - ADR-0010
  - decision: Scope every employee and account row and query by `organisation_id`.
    rationale: Tenant rule.
    alternatives: []
    durable: false
    evidence: []
    scope: api
    status: follows
    follows_adr:
      - ADR-0009
  - decision: Store department as text with a datalist of existing values instead of a select.
    rationale: No department list exists and structure is a separate story.
    alternatives:
      - Department table now
      - Select with a hard-coded list
    durable: false
    evidence: []
    scope: web
    status: proposed
  - decision: Use Alembic for schema migrations in the Core API.
    rationale: No migration tooling exists; reversible PostgreSQL migrations are needed.
    alternatives:
      - Create tables at startup with `metadata.create_all`
    durable: true
    evidence:
      - services/api/migrations/versions/0001_employees.py
    scope: api
    status: proposed
  - decision: Use react-router-dom for Web App routing and keep the design's shell rules in feature CSS built on tokens.
    rationale: No router or shell exists; the shell and `.kv` rules are not in the design stylesheets.
    alternatives:
      - Hand-rolled history routing
    durable: true
    evidence:
      - apps/web/src/App.tsx
    scope: web
    status: proposed

estimated_points: 8

package_dependencies:
  - name: alembic
    version: ">=1.13,<2"
    ecosystem: pip
    rationale: The Core API has no migration tooling; the new tables need a reviewable, reversible migration.
    component_id: comp_core_api
  - name: react-router-dom
    version: "^7.0.0"
    ecosystem: npm
    rationale: The Web App has no routing; the screens need URLs (/employees/:employeeId, /employees/new).
    component_id: comp_web_app

notes: |
  ### Data & rollout
  - **Existing data**: None to migrate. `0001_employees` is the project's first migration and creates `accounts` and `employees` as new tables; no existing row is altered.
  - **Backfill / seed**: No backfill or seed. `accounts` must be populated before HR can create anyone (open question); the epic's spreadsheet import is a separate story.
  - **Settings**: `API_CORS_ORIGINS` (list, default `["http://localhost:5173"]`, safe when unset; in `services/api/app/config.py`, same `API_` prefix as the database URL). Web App `VITE_API_BASE_URL` (default `http://localhost:8000`). Document both in the PR description.
  - **Provisioning**: PostgreSQL at `API_DATABASE_URL`; a Cognito `hr_admin` group and organisation-id claim plus the token verifier (not in this story).
  - **Order and rollback**: run `cd services/api && uv run alembic upgrade head` before starting the new API; roll back with `uv run alembic downgrade base` (drops the two new tables; nothing else references them). The Web App can be reverted independently.

  ### Design reading
  The prototype (`TESTING-20-NOV-STORY-022-design.html`) has two screens: "Employee profile" (states default HR, own, manager, hr-leaver, own-leaver, leaver-hidden, loading, error) and "Create employee profile" (default, duplicate, success). It styles with tokens from `apps/web/design/tokens.css` and classes from `apps/web/design/prototype-utils.css`, plus feature-local rules re-created on tokens. Light only; sentence-case verb-plus-object buttons; one `.btn-primary` per view; `.btn-danger` only in the leaver confirmation; drawer for editing, modal for confirming, as the UI guidelines require.

  ### Prior history
  One earlier commit (c12c65d, scaffold) created the web and API skeletons this plan extends; no earlier decisions to preserve.

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
  Orange nodes are created or modified; `health.py`, `tokens.css` and `prototype-utils.css` are existing context.

review_focus: |
  IN: employee profile create/view/edit/leaver in the Core API and the two approved screens. OUT: directory, structure history, documents, import, audit log, retention, Cognito token verification and account provisioning (seams and open questions only). Riskiest area is `services/employees.py`: personal fields must be absent from the payload for anyone but the employee and HR admins, inactive records must 404 for non-HR (including the leaver), and every query must filter by `organisation_id`. Deliberate: AC8 wins over the design's own-leaver state; department is a datalist input; `get_principal` fails closed until the auth story lands; prototype Employee ID and Start date rows are not built.
