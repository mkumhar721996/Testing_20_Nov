summary: |
  Add a shared "Team availability" calendar. The Core API gets a new authorised read endpoint, GET /availability?week_start=YYYY-MM-DD, that returns every employee in the caller's organisation who is out of office during that Monday-to-Friday week, limited to work-details fields (name, job title, team). The leave type is set on an entry only when the caller is HR or the employee's DIRECT manager; for everyone else it is null. The Web App gets the approved "Team availability" screen (week table, role-dependent Leave type column, empty / loading / error states) as the Overview content of a top-bar app shell. The repo is greenfield for this domain (only /health exists in the API; the web app is a single heading), so the plan also adds the minimum employee and leave tables with a migration, a principal dependency, and the shell. The screen's styling reuses the design system's own stylesheet (apps/web/design/prototype-utils.css) plus a few screen classes defined on the same tokens.
scope:
  - description: |
      API visibility rules as a pure function, written test-first. Signature:

      ```python
      # services/api/app/services/availability.py
      def build_availability(
          viewer: Principal,
          rows: list[OutRow],          # employee + leave rows already filtered by organisation and week
          week_start: date,
      ) -> AvailabilityResponse: ...
      ```

      Rules: every row is returned (AC1). `leave_type` = row.leave_type only if `viewer.is_hr` or `row.manager_id == viewer.employee_id` (direct reports only, so an indirect report is hidden, AC5). Otherwise None (AC2). `days` is five booleans Mon..Fri. Entry fields are exactly employee_id, name, job_title, team, days, leave_type; no manager_id, email or other field (AC6; HR gets the same fields). Response also carries `viewer: {name, can_see_leave_type}` where `can_see_leave_type` is `viewer.is_hr or viewer manages at least one employee`, so the web app knows whether to draw the Leave type column.
    files:
      - services/api/app/services/__init__.py
      - services/api/app/services/availability.py
      - services/api/app/schemas.py
      - services/api/app/auth.py
    rationale: |
      Keeping the rules pure makes ACs 1-6 testable without a database or token. auth.py defines `Principal(employee_id, organisation_id, name, is_hr)` and a `get_principal` FastAPI dependency (ADR-0004); tests override it.
  - description: |
      Persistence: SQLAlchemy models `Employee(id, organisation_id, name, job_title, team, manager_id nullable FK employee.id, is_hr bool)` and `LeaveRecord(id, organisation_id, employee_id FK, leave_type, start_date, end_date, status)`; repository function `list_out_of_office(session, organisation_id, week_start) -> list[OutRow]` returning employees with an APPROVED leave record overlapping Mon..Fri of the week, always filtered by `organisation_id` (ADR-0009). One Alembic migration creates both tables with indexes on (organisation_id, start_date) and manager_id.
    files:
      - services/api/app/models.py
      - services/api/app/repositories/__init__.py
      - services/api/app/repositories/availability.py
      - services/api/alembic.ini
      - services/api/alembic/env.py
      - services/api/alembic/versions/0001_employee_and_leave.py
    rationale: |
      No employee, leave or migration code exists yet (services/api/app holds only config, db, main and routers/health; no alembic directory). Both tables are tenant-owned, so both carry organisation_id.
  - description: |
      Router and wiring. `GET /availability` with optional `week_start: date` (default: Monday of the current week; a non-Monday date is normalised to its Monday), response_model=AvailabilityResponse, dependencies: `get_principal`, a DB session dependency built on `make_engine()` from app/db.py. Include the router in main.py next to health.
    files:
      - services/api/app/routers/availability.py
      - services/api/app/main.py
      - services/api/app/db.py
    rationale: |
      Mirrors routers/health.py. db.py gains a `get_session` dependency only; make_engine stays lazy.
  - description: |
      Load the design system's stylesheets once. apps/web/src/index.css currently holds only `@import "tailwindcss";` (line 1) and main.tsx imports it. Add, after it:

      ```css
      @import "../design/tokens.css";
      @import "../design/prototype-utils.css";
      ```

      prototype-utils.css defines the classes the approved prototype uses from the design system: `.btn`, `.btn-primary`, `.btn-secondary`, `.card`, `.badge` with `.badge-neutral` / `.badge-warning` (and success, danger), `.alert` with `.alert-info` / `.alert-danger`, `.empty-state`, `.skeleton`, `.stack-lg`, `.container`, `.text-muted`, `.text-sm`, `.mt-3`, `.sr-only`. Classes the prototype uses that NO shared stylesheet defines are defined in the app on the same tokens (next two items): `.badge-info`, `.avail`, `.week-bar`, `.week-label`, `.head`, `.page`, `.note`, `.skel-row`, `.table-wrap`, and the `.shell*` classes. Note the prototype-utils.css file also sets body, heading and link base styles; check the shell still looks right next to Tailwind's preflight.
    files:
      - apps/web/src/index.css
    rationale: |
      The tokens are not loaded today (verified: index.css has only the Tailwind import, vite.config.ts has no CSS mapping). One import point, next to Tailwind, in the app's own entry stylesheet.
  - description: |
      Web: API client and screen, built from the approved prototype's "Team availability" screen. `src/api/availability.ts` exports `fetchAvailability(weekStart: string): Promise<AvailabilityResponse>` (GET `/availability?week_start=...`, throws on non-2xx). `src/features/availability/TeamAvailability.tsx` renders, in the prototype's order: `.head` with h1 "Team availability" and "Signed in as {viewer.name}" (`.text-muted .text-sm`); an `.alert .alert-info` role="note" with role copy (employee: "Everyone who is out is listed with work details only. Leave type is visible to the employee's manager and HR."; manager: "Leave type is shown for your direct reports only."; HR: "Leave type is shown for everyone who is out."); `.week-bar` with "Previous week" / "Next week" `.btn .btn-secondary` icon buttons (aria-label, chevron icons) around `.week-label` "Week of 23–27 Nov 2026"; a `.card .table-wrap` (padding 0) holding `<table class="avail">` with columns Employee (row header: name in strong, job title below), Team, Mon..Fri, and "Leave type" only when `viewer.can_see_leave_type`; a day cell is `<td class="day" data-label="Tue 24">` with `<span class="badge badge-info">Out</span>` or `<td class="day off">—</td>`; the type cell is `<td class="type">` with a badge (Vacation `badge-info`, Sick `badge-warning`, Unpaid `badge-neutral`) or `<span class="hidden-type">Not shown</span>` when `leave_type` is null; today's `th.day.today` carries `aria-current="date"`; for non-managers a `.note .text-muted .text-sm` line "Shows the work details the directory shows: name, job title and team."

      States from the prototype: empty (week bar, then `.empty-state` with h2 "Nobody is out this week", muted text "Everyone who is on approved leave appears here so teams can plan. Check another week to see upcoming time off." and one `.btn .btn-primary` "Show next week" that moves week_start forward); loading (`.card` with a visible `<p class="text-muted text-sm" role="status">Loading team availability…</p>` and five `.skeleton.skel-row`, wrapper aria-busy="true"); error (`.alert .alert-danger` role="alert" "Team availability did not load." plus "Check your connection and try again. Nobody is hidden from the calendar; it just has not loaded." and a `.btn .btn-secondary` "Try again" that refetches). Previous / Next week change `week_start` by seven days and refetch. Tokens/behaviour replace the prototype's inline sample data and its toast on week buttons; do not carry the sample people into code.

      Phone layout (prototype): no horizontal scroll at 375px. Below 40rem (media queries cannot read tokens, so the literal 40rem is in the CSS media query) `.avail thead` is hidden, `.avail tbody` and `tr` become a stacked flex block with `gap: var(--space-2)` and `padding: var(--space-3)`, `.who` takes the full row, `td.day.off` is hidden, `td[data-label]::before` prints the day label, and `td.type::before` prints "Leave type: ". There is no sr-only "In" or "(today)" text.
    files:
      - apps/web/src/api/availability.ts
      - apps/web/src/features/availability/TeamAvailability.tsx
      - apps/web/src/features/availability/availability.css
      - apps/web/src/features/availability/TeamAvailability.test.tsx
    rationale: |
      The default / manager / hr views are one component whose column and copy depend on `viewer`; no router is added (none exists and the story needs one screen). availability.css defines the classes the prototype declares inline, using only tokens: `.badge-info` (background var(--color-info-bg), color var(--color-info)); `.page` (padding-block var(--space-4)); `.head` (flex, wrap, space-between, baseline, gap var(--space-2)); `.week-bar` (flex, wrap, space-between, gap var(--space-2); its .btn min-height and min-width var(--size-tap)); `.week-label` (font-weight var(--font-weight-medium)); `.note` (margin 0); `.table-wrap` (overflow-x auto); `.skel-row` (height var(--size-skeleton), margin-bottom var(--space-3)); and the `.avail` rules (font-size var(--font-size-sm), cell padding var(--space-2) var(--space-3), borders var(--border-width) solid var(--color-border), header colour var(--color-fg-muted), `th.today` colour var(--color-info) on var(--color-info-bg), `.hidden-type` colour var(--color-fg-muted) italic). The prototype has two raw values no token covers, `.who` min-width 160px and `.page` padding-bottom 56px; see the open questions.
  - description: |
      App shell from the prototype's shell (the markup and CSS come from apps/web/design/app-shell.html). `AppShell.tsx`: header with brand link "Comp", a "Menu" `.btn .btn-secondary` toggle (aria-controls main-nav, aria-expanded) shown below 48rem, `<nav id="main-nav" aria-label="Main">` with links Overview / Items / Reports / Settings (`data-nav-key` overview, items, reports, settings), Account link at the right (`data-nav-key="account"`), the current section link `aria-current="page"` (Overview for this screen), a `.shell-layout` main content area, and a footer with Help and Privacy links. `app-shell.css` defines `.shell`, `.shell-header`, `.shell-brand`, `.shell-menu-btn`, `.shell-nav`, `.shell-link`, `.shell-layout`, `.shell-footer` on tokens exactly as app-shell.html does (only var(--...) values; the 48rem media query is the one literal). `App.tsx` renders the shell with TeamAvailability as its content. The existing App.test.tsx and e2e/app.spec.ts assert a "Web App" heading and are updated to the new shell. vite.config.ts gets a dev `server.proxy` for `/availability` to http://localhost:8000.
    files:
      - apps/web/src/components/AppShell.tsx
      - apps/web/src/components/app-shell.css
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/vite.config.ts
      - apps/web/e2e/app.spec.ts
    rationale: |
      UI guidelines require the top-bar-only shell, the section order, the Menu collapse below 48rem, and every screen marking its section current. The .shell* classes live only in app-shell.html's inline style, not in a loaded stylesheet, so the app defines them.
tests:
  - |
    AC1 (write first) services/api/tests/unit/test_availability_service.py — every out-of-office employee is returned to an ordinary employee.
    ```python
    def test_employee_sees_everyone_who_is_out():
        viewer = Principal(employee_id=1, organisation_id=1, name="Priya", is_hr=False)
        resp = build_availability(viewer, [row(10), row(11), row(12)], MON)
        assert [e.employee_id for e in resp.entries] == [10, 11, 12]
    ```
    Also the repository test (test_availability_repository.py, in-memory SQLite) asserts an approved leave overlapping the week is listed, a pending or other-week one is not, and another organisation's employee is never returned (ADR-0009). A second repository test creates the tables from the models and reads seeded rows back through `list_out_of_office`.
  - |
    AC2 — non-HR, non-direct-manager viewer gets no leave type.
    ```python
    def test_leave_type_hidden_from_unrelated_employee():
        viewer = Principal(1, 1, "Priya", is_hr=False)
        resp = build_availability(viewer, [row(10, manager_id=99, leave_type="Sick")], MON)
        assert resp.entries[0].leave_type is None
        assert resp.viewer.can_see_leave_type is False
    ```
  - |
    AC3 — direct manager sees their team member's leave type.
    ```python
    def test_manager_sees_direct_report_leave_type():
        viewer = Principal(5, 1, "Daniel", is_hr=False)
        resp = build_availability(viewer, [row(10, manager_id=5, leave_type="Sick")], MON)
        assert resp.entries[0].leave_type == "Sick"
        assert resp.viewer.can_see_leave_type is True
    ```
  - |
    AC4 — HR sees every leave type.
    ```python
    def test_hr_sees_all_leave_types():
        viewer = Principal(2, 1, "Hira", is_hr=True)
        resp = build_availability(viewer, [row(10, manager_id=5, leave_type="Unpaid")], MON)
        assert resp.entries[0].leave_type == "Unpaid"
    ```
  - |
    AC5 — indirect report hidden from the manager above.
    ```python
    def test_manager_does_not_see_indirect_report_leave_type():
        viewer = Principal(5, 1, "Daniel", is_hr=False)
        # employee 20 reports to 10, who reports to 5
        resp = build_availability(viewer, [row(20, manager_id=10, leave_type="Vacation")], MON)
        assert resp.entries[0].leave_type is None
    ```
  - |
    AC6 — only work-details fields are exposed to a non-HR viewer, checked at the HTTP layer. services/api/tests/unit/test_availability_router.py overrides `get_principal` and the session and calls GET /availability with FastAPI's TestClient (httpx).
    ```python
    def test_entry_has_only_work_details_fields():
        body = client.get("/availability?week_start=2026-11-23").json()
        assert set(body["entries"][0]) == {"employee_id", "name", "job_title", "team", "days", "leave_type"}
        assert body["entries"][0]["leave_type"] is None
    ```
    The same file asserts a 401 when no principal is available.
  - |
    Web (apps/web/src/features/availability/TeamAvailability.test.tsx, vitest + Testing Library, fetch mocked). Covers AC1 and AC2/AC5 in the UI plus the prototype's states.
    ```tsx
    it('shows every employee but no Leave type column for an employee', async () => {
      mockFetch({ viewer: { name: 'Priya Raman', can_see_leave_type: false }, entries: [entry('Marta Silva'), entry('Hana Sato')] })
      render(<TeamAvailability />)
      expect(await screen.findByText('Marta Silva')).toBeInTheDocument()
      expect(screen.getByText('Hana Sato')).toBeInTheDocument()
      expect(screen.queryByRole('columnheader', { name: 'Leave type' })).not.toBeInTheDocument()
    })
    ```
    Further cases: today's header has `expect(screen.getByRole('columnheader', { name: 'Tue 24' })).toHaveAttribute('aria-current', 'date')`; an out day renders an "Out" badge inside a cell with `data-label="Tue 24"`; manager view shows a badge for `leave_type: 'Sick'` and "Not shown" for `leave_type: null`; HR view shows all badges; an empty list shows "Nobody is out this week" and a "Show next week" button that calls fetch with the following Monday; pending fetch shows the status text "Loading team availability…"; rejected fetch shows role alert "Team availability did not load." and "Try again" refetches.
  - |
    Shell (apps/web/src/App.test.tsx, updated): `expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')` and the four section links render in the order Overview, Items, Reports, Settings, with Account after them. Playwright e2e/app.spec.ts is updated to assert the "Team availability" heading with the /availability route mocked.
  - |
    Builder first verification step: run `(cd services/api && uv run pytest tests/unit) && (cd apps/web && pnpm test)` on the untouched branch to confirm the baseline passes, then `cd apps/web && pnpm typecheck` after the web changes. The existing App.test.tsx fails until it is updated; that is expected. Also open the screen in a browser at 375px and at desktop width and compare it with the prototype.
assumptions_or_open_questions:
  - |
    Authentication is not implemented anywhere in the repo (ADR-0004 says Cognito-issued tokens only). This plan defines the `Principal` dependency and overrides it in tests, but `get_principal` must verify a Cognito token and map it to an employee row. Who owns real token verification and the claim for organisation and HR? Until it exists the endpoint returns 401 outside tests. Please confirm whether another story covers it.
  - |
    No employee or leave tables exist. I assumed this story creates minimal ones (employee with manager_id and is_hr, and leave_record with an approved status). If an employee-directory or leave-request story owns those tables, this plan should reuse them; please confirm so the migration is not duplicated.
  - |
    "Out of office" is assumed to mean an APPROVED leave record whose dates overlap the displayed Monday-to-Friday week. Public holidays and attendance records are not included.
  - |
    Open question from the item: does the directory's work-details-only rule apply? Treated as yes for non-HR (AC6) with the fields the design shows (name, job title, team). The directory's real field list is not in the repo; HR gets the same fields. Please confirm the list.
  - |
    Open question from the item: manager reach beyond their team. AC5 settles it for leave type: direct reports only, no indirect reports. A viewer's own leave type is also hidden unless they are HR, following AC2 literally.
  - |
    Design notes. The prototype's `.head` and `.empty-state` blocks are marked as coming from story TESTING-20-NOV-STORY-032; this plan builds them locally in the availability feature and does not coordinate shared components. The prototype's inline sample people and its week-button toast are not carried into code. The prototype's "Try again" jumps to the loading state; the plan makes it refetch. `.empty-state h2` is not styled by prototype-utils.css (it styles h3); the prototype uses h2, so the plan keeps h2 as designed.
  - |
    Two raw values in the prototype have no token: `.who` min-width 160px and `.page` padding-bottom 56px. Until decided, the builder should leave both out (the table cell can size to its content, and the page can rely on the shell footer spacing) rather than hard-code them. Please say whether to add tokens or accept these two literals. The invalid `--duration-fast: [object Object]` in the design tokens means no token-driven transitions are planned.
  - |
    Alembic is added as a new dependency to run the migration. If the project prefers another migration mechanism, say so and I will change it. Retention of leave records and audit history (project-wide open questions) is out of scope; this endpoint is read-only. The off-day "—" cells carry no screen-reader text in the prototype; accepted as designed.
estimated_points: 8
package_dependencies:
  - name: alembic
    version: ">=1.13"
    ecosystem: pip
    rationale: Versioned migration that creates the employee and leave_record tables; no migration tooling exists in services/api yet.
    component_id: comp_core_api
notes: |
  ### Data & rollout

  - **Existing data**: the migration only creates two new tables (employee, leave_record); no existing rows are touched. Both carry a NOT NULL organisation_id (ADR-0009); manager_id is nullable so top-level employees are valid.
  - **Backfill / seed**: none for the system itself. Tests seed their own rows. Real employees and leave come from other stories or an import; see the open questions.
  - **Settings**: none new. The web app calls `/availability` on the same origin, with a dev proxy in vite.config.ts. The existing `API_DATABASE_URL` (services/api/app/config.py) is reused.
  - **Provisioning**: the Cognito integration that supplies `get_principal` (first open question) must exist before this works in a deployed environment.
  - **Order and rollback**: run `alembic upgrade head` before deploying the new API code. Rollback is `alembic downgrade -1`, which drops the two new tables; safe because nothing else reads them yet.
  - **Test on the migration**: a repository test creates the tables from the models on in-memory SQLite and reads seeded rows back.

  ### Styling load path

  apps/web/src/index.css line 1 is `@import "tailwindcss";`, imported by apps/web/src/main.tsx; vite.config.ts only registers the react and tailwindcss plugins. The plan adds the tokens and prototype-utils.css imports right after line 1. Tokens in use by the screen include --color-fg-muted, --color-border, --color-info, --color-info-bg, --color-danger, --color-warning-bg, --color-surface-sunken, --space-1 to --space-4, --size-tap, --size-skeleton, --size-container, --font-size-sm, --font-weight-medium, --border-width.

  ```mermaid
  flowchart TD
    main[app/main.py] --> health[routers/health.py]
    main --> avrouter[routers/availability.py]
    avrouter --> auth[auth.py get_principal]
    avrouter --> repo[repositories/availability.py]
    avrouter --> svc[services/availability.py]
    repo --> models[models.py]
    db[db.py make_engine] --> repo
    mainTsx[web main.tsx] --> appx[web App.tsx]
    appx --> shell[components/AppShell.tsx]
    shell --> page[features/availability/TeamAvailability.tsx]
    page --> client[api/availability.ts]
    client -->|GET /availability| avrouter
    mainTsx --> css[index.css]
    css -->|imports| tokens[design/tokens.css]
    css -->|imports| utils[design/prototype-utils.css]
    classDef touched fill:#f96,color:#000
    class main,avrouter,auth,repo,svc,models,db,appx,shell,page,client,css touched
  ```

  Why the shape: ADR-0001/0002 (screens call only the API; only the API touches the DB) and ADR-0009 (every query filtered by organisation id) drive the layering. Visibility is decided server-side so leave type never leaves the API for an unauthorised viewer; the UI only renders what it receives.
review_focus: |
  IN: the read-only GET /availability endpoint with server-side leave-type visibility (HR or direct manager only), minimal employee and leave tables with one migration, the approved Team availability screen with its states and 40rem phone layout, the top-bar shell, and loading the design system's tokens and prototype-utils.css. OUT: real Cognito token verification, leave requests and approvals, retention and audit, public holidays. Riskiest part is the visibility rule: leave_type must be null for indirect managers and unrelated viewers and no extra fields may leak; check the service tests and the organisation filter in the repository. Deliberate choices: the viewer's own leave type is hidden unless HR (AC2 literal), no router library is added, and screen-only classes are defined in the app because no shared stylesheet has them.
