summary: |
  Build self-service attendance end to end: a Core API (FastAPI + PostgreSQL) with an `attendance_records` table and three caller-scoped endpoints (clock in, clock out, list own records, newest first), and a single "My attendance" screen in the Web App built from the approved prototype (status card with Clock in / Clock out, own-records table, empty / loading / error states, persistent refusal alerts). The caller's identity and organisation always come from the verified token, never from the request, so a request naming another employee is refused (403) and one employee can never read another's records. Refusals (already clocked in / not clocked in) are 409s that change nothing, and the UI shows them as visible danger alerts. HR/manager views and corrections, and any badge/device feed, are out of scope (attendance records story).
scope:
  - description: |
      Core API data model and migration. Add SQLAlchemy 2.0 declarative base + `AttendanceRecord` model and an Alembic migration creating `attendance_records`:
      `id` uuid PK, `organisation_id` uuid NOT NULL (ADR-0009), `employee_id` uuid NOT NULL, `clock_in_at` timestamptz NOT NULL, `clock_out_at` timestamptz NULL.
      Indexes: `(organisation_id, employee_id, clock_in_at DESC)` for the list query, and a PARTIAL UNIQUE index on `(organisation_id, employee_id) WHERE clock_out_at IS NULL` so the database itself guarantees at most one open record per employee even under concurrent double-clicks.
      Add `get_session` dependency in `app/db.py` (uses the existing lazy `make_engine`).
    files:
      - services/api/app/models.py
      - services/api/app/db.py
      - services/api/alembic.ini
      - services/api/migrations/env.py
      - services/api/migrations/versions/0001_create_attendance_records.py
    rationale: |
      No models, migrations or session dependency exist yet (`app/db.py` only has `make_engine`). ADR-0003 and ADR-0009 require data in PostgreSQL with an organisation id on every tenant-owned table.
  - description: |
      Caller identity seam. Add `app/auth.py` with
      `class Principal(BaseModel): employee_id: UUID; organisation_id: UUID` and
      `def get_current_principal(authorization: str = Header(...)) -> Principal` that verifies the bearer token (issuer, audience, signature against the Identity Provider's JWKS, configured through `API_` settings in `app/config.py`) and maps its claims to employee and organisation ids. Missing/invalid token gives 401. All attendance routes depend on it; tests override it with `app.dependency_overrides`.
    files:
      - services/api/app/auth.py
      - services/api/app/config.py
    rationale: |
      ADR-0004: users authenticate only through the Identity Provider (Amazon Cognito) and the Core API accepts only its tokens. No token verification exists in the API yet, and AC 4/5 depend on a trustworthy caller identity.
  - description: |
      Attendance service + router. `app/services/attendance.py` holds the rules, `app/routers/attendance.py` is thin and registered in `app/main.py`.
      Endpoints (all under the caller's own principal; every query filters by `organisation_id` AND `employee_id`):
      `GET /attendance/records` returns the caller's records newest first (`ORDER BY clock_in_at DESC`), each `{id, date, clock_in_at, clock_out_at}` with `clock_out_at: null` for the open record.
      `POST /attendance/clock-in` returns 201 with the new record; 409 `{"detail": {"code": "already_clocked_in", ...}}` when an open record exists (existing record untouched, AC 7).
      `POST /attendance/clock-out` returns 200 with the closed record; 409 `{"code": "not_clocked_in"}` when none is open, inserting nothing (AC 9).
      Optional request body `{"employee_id": UUID | null}` on both POSTs: if present and different from `principal.employee_id` the request is refused with 403 `{"code": "other_employee"}` before any read or write (AC 5). The body field exists only so the refusal is testable and explicit; the UI never sends it.
      The clock-in insert catches the partial-unique-index violation (`IntegrityError`) and maps it to the same 409.
      Signatures:
      `def clock_in(session: Session, principal: Principal, now: datetime) -> AttendanceRecord`
      `def clock_out(session: Session, principal: Principal, now: datetime) -> AttendanceRecord`
      `def list_records(session: Session, principal: Principal) -> list[AttendanceRecord]`
      with `class AlreadyClockedIn(Exception)` / `class NotClockedIn(Exception)`. `now` is injected (server clock, UTC) so tests are deterministic.
    files:
      - services/api/app/services/__init__.py
      - services/api/app/services/attendance.py
      - services/api/app/schemas.py
      - services/api/app/routers/attendance.py
      - services/api/app/main.py
    rationale: |
      ADR-0001/0002: screens reach data only through the Core API, which alone touches the database and authorises every request against the caller's organisation. Server-side refusals (not UI-only) are what make AC 5, 7 and 9 true.
  - description: |
      Dependencies and settings. Add `alembic` and `PyJWT[crypto]` to `services/api/pyproject.toml` (via `uv add`); add JWKS URL / issuer / audience settings with safe unset behaviour (all protected routes return 401 when unset).
    files:
      - services/api/pyproject.toml
      - services/api/app/config.py
    rationale: |
      Migration tooling and JWT verification are the only new libraries; SQLAlchemy, psycopg, FastAPI and pytest/httpx are already installed.
  - description: |
      Web: load the design system once. In `apps/web/src/index.css`, after `@import "tailwindcss";`, add `@import "../design/tokens.css";` and `@import "../design/prototype-utils.css";`. This defines the real token names (`--color-*`, `--space-*`, `--size-container`, ...) and the classes the prototype uses (`.card`, `.badge`, `.badge-neutral`, `.badge-success`, `.btn`, `.btn-primary`, `.btn-secondary`, `.alert`, `.alert-danger`, `.empty-state`, `.skeleton`, `.toast`, `.container`, `.stack`, `.stack-sm`, `.stack-lg`, `.text-muted`, `.text-sm`, `.sr-only`). The page-only classes from the prototype's inline style (`.page`, `.status-row`, `.status-time`, `.actions`, `.table-wrap`, `.records`, `.skel-row`, `.head`) are defined in `apps/web/src/features/attendance/attendance.css` using only tokens, imported by `AttendancePage.tsx`.
    files:
      - apps/web/src/index.css
      - apps/web/src/features/attendance/attendance.css
    rationale: |
      `index.css` currently holds only the Tailwind import and `main.tsx:4` imports it, so nothing loads the tokens yet. The prototype's own padding-bottom of 56px and toast offset exist to clear the reviewer bar and are NOT carried over.
  - description: |
      Web: API client and data hook (no new packages, uses `fetch`). `apps/web/src/features/attendance/api.ts`:
      `export type AttendanceRecord = { id: string; date: string; clockInAt: string; clockOutAt: string | null }`
      `export class RefusedError extends Error { code: 'already_clocked_in' | 'not_clocked_in' | 'other_employee' }`
      `export function listRecords(): Promise<AttendanceRecord[]>`, `clockIn()`, `clockOut()` (the latter two throw `RefusedError` on 403/409). Base URL from `import.meta.env.VITE_API_BASE_URL`; bearer token from a small `getAccessToken()` seam. `useAttendance.ts` exposes `{ status: 'loading' | 'ready' | 'error', records, clockedIn, refusal, clockIn, clockOut, reload }`; `clockedIn` is derived from "newest record has `clockOutAt === null`" and every action re-fetches the list so the screen always reflects server truth.
    files:
      - apps/web/src/features/attendance/api.ts
      - apps/web/src/features/attendance/useAttendance.ts
      - apps/web/src/auth/getAccessToken.ts
    rationale: |
      Replaces the prototype's inline JSON sample data with real API data. ADR-0001: the Web App reaches data only through the API.
  - description: |
      Web: "My attendance" screen, built from the prototype's `My attendance` screen and its states (default, clocked-in, refused-clock-in, refused-clock-out, refused-other, empty, loading, error).
      `AttendancePage.tsx`: `<main class="container page stack-lg">`; `.head` row with `<h1>My attendance</h1>`; then `StatusCard` and, below, `<h2>Your records</h2>` with `AttendanceRecordsTable`.
      `StatusCard.tsx`: `.card.stack` > `.status-row`; left `.stack-sm` holds a `.badge` (`badge-neutral` "Clocked out" / `badge-success` "Clocked in"), `.status-time` ("Not clocked in" / "Since 09:02 today") and a muted line (last clock out, or the date); right `.actions` with two buttons, both always rendered (so a refusal can be reached and reviewed, as in the prototype). The valid next step is `.btn-primary`, the other `.btn-secondary` (one primary per screen, per UI guidelines); each `.btn` uses `min-height: var(--size-tap)`. Buttons are disabled while a request is in flight (`.spinner`) to prevent double submission.
      `AttendanceRecordsTable.tsx`: `.card.table-wrap` (padding 0) > `table.records` with columns Date, Clock in, Clock out, Hours (numeric columns `.num`, tabular-nums). The open record shows `.badge.badge-success` "In progress" in Clock out and "—" in Hours. Times are 24h (`HH:mm`), dates like "Mon 23 Nov 2026", both in the browser's local time zone. Rows are rendered in the order the API returns (newest first, AC 10).
      Refusals render as persistent `.alert.alert-danger` with `role="alert"` above the status card, never a toast: "You are already clocked in. Clock out first if you want to end this shift. Your clock in time of {HH:mm} is unchanged." / "You are not clocked in. Clock in first to start a shift. No record was added." / "Request refused. It named another employee. You can only clock yourself in or out. Nothing was recorded for anyone."
      A successful action shows a `.toast` (`role="status"`, auto-hides after about 4 s): "Clocked in at 09:02." / "Clocked out at 17:31. Record saved."
      Empty (no records): status card plus `.empty-state` with `<h2>No attendance records yet</h2>`, the prototype's explanatory sentence and one `.btn-primary` "Clock in". Loading: `aria-busy="true"` with `.skeleton.skel-row` blocks and a `.sr-only` status "Loading your attendance records". Error: `.alert.alert-danger` "Your records did not load. Check your connection and try again..." with a `.btn-secondary` "Try again".
      `App.tsx` renders `AttendancePage` (replacing the placeholder heading); `App.test.tsx` and `e2e/app.spec.ts`, which assert the old "Web App" heading, are updated accordingly.
    files:
      - apps/web/src/features/attendance/AttendancePage.tsx
      - apps/web/src/features/attendance/StatusCard.tsx
      - apps/web/src/features/attendance/AttendanceRecordsTable.tsx
      - apps/web/src/features/attendance/format.ts
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/e2e/app.spec.ts
    rationale: |
      Tokens used by name: `--space-2/3/4`, `--size-container`, `--size-tap`, `--font-size-sm/lg/xl`, `--font-weight-bold/medium`, `--line-height-tight`, `--color-fg-muted`, `--color-border`, `--border-width`, `--size-skeleton` (all from `apps/web/design/tokens.css`). No colour or pixel literals are planned.
tests:
  - |
    AC1 (API, write first) `services/api/tests/unit/test_attendance_service.py`. Not clocked in, then clock in:
    ```python
    rec = clock_in(session, principal_a, NOW)
    assert rec.clock_out_at is None
    assert [r.id for r in list_records(session, principal_a)] == [rec.id]
    ```
    Router: `r = await client.post("/attendance/clock-in")` gives `assert r.status_code == 201` and `assert r.json()["clock_out_at"] is None`.
  - |
    AC1 (Web) `AttendancePage.test.tsx` with `fetch` mocked: no open record, click, status flips.
    ```tsx
    await user.click(screen.getByRole('button', { name: 'Clock in' }))
    expect(await screen.findByText('Clocked in')).toBeInTheDocument()
    ```
  - |
    AC2 (API) after a clock in, clock out closes the same record:
    ```python
    rec = clock_in(session, principal_a, NOW)
    out = clock_out(session, principal_a, NOW + timedelta(hours=8))
    assert out.id == rec.id and out.clock_out_at == NOW + timedelta(hours=8)
    ```
    (Web) open record present, click Clock out: `expect(await screen.findByText('Clocked out')).toBeInTheDocument()`.
  - |
    AC3 (API) `GET /attendance/records` after clock in and clock out:
    ```python
    body = (await client.get("/attendance/records")).json()
    assert body[0].keys() >= {"date", "clock_in_at", "clock_out_at"}
    assert body[0]["clock_out_at"] is not None
    ```
    (Web) `AttendanceRecordsTable.test.tsx`: `expect(within(row).getByText('Mon 23 Nov 2026')).toBeInTheDocument()`, `'08:58'` and `'17:12'` in the same row.
  - |
    AC4 (API) records for A and B exist in the same organisation; A lists only A's:
    ```python
    clock_in(session, principal_b, NOW)
    clock_in(session, principal_a, NOW)
    assert {r.employee_id for r in list_records(session, principal_a)} == {principal_a.employee_id}
    ```
    Plus a different-organisation case: same `employee_id`, other `organisation_id`, is not returned (ADR-0009).
  - |
    AC5 (API) naming another employee is refused and nothing is written:
    ```python
    r = await client.post("/attendance/clock-in", json={"employee_id": str(principal_b.employee_id)})
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "other_employee"
    assert list_records(session, principal_b) == []
    ```
    Same for `/attendance/clock-out`. Also `assert (await client.post("/attendance/clock-in")).status_code == 401` with no token.
  - |
    AC6 (API + Web) clocking in twice: `assert second.status_code == 409` and `assert second.json()["detail"]["code"] == "already_clocked_in"`. Web: server answers 409, then `expect(await screen.findByRole('alert')).toHaveTextContent('You are already clocked in')`.
  - |
    AC7 (API) the original time survives the refused clock in:
    ```python
    first = clock_in(session, principal_a, NOW)
    with pytest.raises(AlreadyClockedIn):
        clock_in(session, principal_a, NOW + timedelta(hours=1))
    assert list_records(session, principal_a)[0].clock_in_at == NOW
    assert len(list_records(session, principal_a)) == 1
    ```
    Also a DB-level test that inserting a second open row for the same employee raises `IntegrityError`. Web: the alert text and the "Since 09:02 today" line are both still shown.
  - |
    AC8 (API + Web) clock out while clocked out: `assert r.status_code == 409` and `assert r.json()["detail"]["code"] == "not_clocked_in"`. Web: `expect(await screen.findByRole('alert')).toHaveTextContent('You are not clocked in')`.
  - |
    AC9 (API) refused clock out adds no entry:
    ```python
    before = len(list_records(session, principal_a))
    with pytest.raises(NotClockedIn):
        clock_out(session, principal_a, NOW)
    assert len(list_records(session, principal_a)) == before
    ```
    Web: row count in the table is unchanged after the refusal.
  - |
    AC10 (API) several records come back newest first:
    ```python
    times = [r.clock_in_at for r in list_records(session, principal_a)]
    assert times == sorted(times, reverse=True)
    ```
    (Web) rows render in the API order: `expect(rows[0]).toHaveTextContent('Mon 23 Nov 2026')`.
  - |
    UI states (Web, `AttendancePage.test.tsx`): empty gives `getByRole('heading', { name: 'No attendance records yet' })` and one `Clock in` button; loading gives `getByRole('status')` with "Loading your attendance records"; list failure gives an alert "Your records did not load" and a "Try again" button that re-fetches.
  - |
    End to end (Playwright `apps/web/e2e/attendance.spec.ts`, API routes mocked with `page.route`; pytest + httpx API e2e in `services/api/tests/e2e/test_attendance_e2e.py` over `httpx.ASGITransport`): sign in as A, Clock in, Clock out, record row visible with date and both times; and A cannot see B's record.
  - |
    Narrow verification commands: `(cd services/api && uv run pytest tests/unit/test_attendance_service.py tests/unit/test_attendance_router.py)` and `(cd apps/web && pnpm test src/features/attendance)`. Full suite before finishing: `(cd services/api && uv run pytest tests/unit) && (cd apps/web && pnpm test)`.
assumptions_or_open_questions:
  - |
    BLOCKER TO CONFIRM: the repository has no sign-in, no Cognito integration, no employee entity and no organisation concept yet (the API has only `/health`; the Web App is a placeholder heading). This plan adds a `get_current_principal` token-verification dependency in the API and a `getAccessToken()` seam in the Web App, but NOT a sign-in screen or Cognito hosted-UI flow. Who delivers sign-in and the employee/organisation tables? If another story does, this one should depend on it and `Principal` should be wired to it.
  - |
    ADR-0010: fetching Cognito's JWKS is an external system call and must be recorded as an integration first. Please confirm that integration is recorded (or approve recording it) before the implementation adds the JWKS fetch.
  - |
    `employee_id` and `organisation_id` are plain uuid columns with no foreign keys, because no employees/organisations tables exist. Add the FKs when those tables land.
  - |
    Time handling: timestamps are stored in UTC (`timestamptz`) and displayed in the browser's local time zone; a record's "date" is the local date of its clock in, and an overnight shift stays on the day it started. Confirm whether an organisation-level time zone is wanted instead.
  - |
    The prototype shows an "Hours" column and a `.alert-success` banner ("You clocked in at 09:02 today.") in the clocked-in state in addition to a toast. AC 3 asks only for date, clock in and clock out. Plan keeps Hours (derived on the client, no stored field) and shows success as the toast plus the status card instead of a second persistent banner, because the UI guidelines say toasts confirm completed actions and alerts are for problems. Say if the banner should be kept.
  - |
    The prototype notes there is no Attendance section in the top bar and places the screen under Overview. The Web App has no app shell or top bar yet (`apps/web/design/app-shell.html` exists but is not built). Plan renders the page without a shell; building the top bar and routing is a separate piece of work. Please confirm that is acceptable.
  - |
    `apps/web/design/tokens.css` lines 70-72 define `--duration-fast`, `--duration-spin` and `--duration-pulse` as the literal text `[object Object]` (a token build bug), so button transitions, the spinner and the skeleton pulse will not animate until tokens are regenerated. Not fixed here; it is a design-system issue.
  - |
    Retention and audit history for attendance records (open project question from EPIC-011) is not answered here: the table keeps rows indefinitely and nothing is deleted. Expected load (100 concurrent / 10,000 users, ADR-0006) is well within a single indexed query per request.
  - |
    A refused request (409/403) is not itself logged as an audit event; only successful clock events are stored. Confirm whether refused attempts must be recorded.
estimated_points: 8
package_dependencies:
  - name: alembic
    version: ">=1.13"
    ecosystem: pip
    component_id: comp_core_api
    rationale: Versioned schema migration for the new attendance_records table; none exists in the API yet.
  - name: PyJWT
    version: ">=2.9,<3"
    ecosystem: pip
    component_id: comp_core_api
    rationale: Verify the Identity Provider's bearer tokens (signature, issuer, audience) in get_current_principal; needs the crypto extra for RS256.
notes: |
  ### Data & rollout
  - **Existing data**: new table only. No existing table or row is altered, so nothing already stored is affected.
  - **Backfill / seed**: none needed; the table starts empty and the empty state covers it. No seed. The migration is idempotent under Alembic's version tracking.
  - **Settings**: new `API_`-prefixed settings in `services/api/app/config.py` for the identity provider (JWKS URL, issuer, audience). Unset means every protected route returns 401, which is safe. Web: `VITE_API_BASE_URL`, default same-origin. Both are documented in the file that defines them.
  - **Provisioning**: a PostgreSQL database reachable via `API_DATABASE_URL`; the Cognito user pool and its JWKS URL (provisioned outside this story).
  - **Order and rollback**: run `cd services/api && uv run alembic upgrade head` before deploying the new API code; the Web App deploys after the API. Rollback is `alembic downgrade -1` (drops `attendance_records`, losing attendance data, so only before real use) or leave the table in place, since old code ignores it.

  ### Design reading
  Read the whole prototype (`TESTING-20-NOV-STORY-032-design.html`): one screen, "My attendance", with eight states. The record table is marked new (`AttendanceRecordsTable`). All its classes are defined in `apps/web/design/prototype-utils.css` except the page-only ones in its inline `<style>`, which this plan re-defines on tokens. The UI guidelines say `.toast` confirms an action and `.alert` carries problems; the plan follows that.

  ### Existing code touched
  `services/api/app/main.py` (includes routers), `services/api/app/db.py` (`make_engine`), `services/api/app/config.py` (`Settings`, `API_` prefix), `services/api/app/routers/health.py` (pattern for routers), `apps/web/src/main.tsx` line 4 (imports `index.css`), `apps/web/src/index.css`, `apps/web/src/App.tsx`.

  ```mermaid
  flowchart TD
    Main[main.tsx] --> Css[index.css]
    Main --> App[App.tsx]
    Css --> Tokens[design/tokens.css + prototype-utils.css]
    App --> Page[AttendancePage]
    Page --> Hook[useAttendance + api.ts]
    Hook -->|HTTP| Router[routers/attendance.py]
    Router --> Auth[auth.py get_current_principal]
    Router --> Svc[services/attendance.py]
    Svc --> Models[models.py]
    Models --> DB[(PostgreSQL attendance_records)]
    Svc --> Db[db.py get_session]
    classDef touched fill:#f96,color:#000
    class Css,App,Page,Hook,Router,Auth,Svc,Models,Db touched
  ```
review_focus: |
  IN: self-service clock in/out and own-records list (API, migration, Web screen from the approved prototype). OUT: HR/manager views, corrections, device feeds, sign-in/Cognito flow, app shell/top bar. Riskiest areas: identity and tenant scoping (every query must filter by organisation_id AND employee_id from the token, never from the request body) and the clock-in race, which is handled by the partial unique index plus 409 mapping. Deliberate choices: both buttons always render so refusals are reviewable, refusals are persistent alerts (not toasts), the optional `employee_id` body field exists only to make the AC 5 refusal explicit, and the identity seam is overridden in tests because no sign-in exists yet.
