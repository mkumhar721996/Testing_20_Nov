summary: |
  Let warehouse staff record a stock movement (item, quantity, in or out) from the Dashboard without leaving it, and see the Dashboard figures update. The repo today holds only a placeholder `App.tsx` ("Web App" heading), a health-only FastAPI app and an unused `make_engine()`: there is no Dashboard, no items, no stock data, no migrations and no auth. So the whole feature is built end to end. The Core API gets tables for items and stock movements, an Alembic migration, a service that records a movement atomically and refuses to take on-hand stock below zero, and three endpoints (items, dashboard figures, record movement). The Web App gets the design system wired in, a minimal shell, a Dashboard page (loading, empty, error, default) with the two figures this story updates ("Items in stock", "Movements today") and the Recent movements table, and the Record movement drawer with inline validation, an in-drawer failure alert and a success toast. Everything follows the approved prototype TESTING-20-NOV-UX-DESIGN-004. Tests come first at each layer: pytest for service and HTTP, vitest for validation, drawer and Dashboard, Playwright for the flow.

scope:
  - description: |
      Wire the design system into the Web App once. `apps/web/src/index.css` today is only `@import "tailwindcss";`. Change it to:

      ```css
      @import "tailwindcss";
      @import "../design/tokens.css";
      @import "../design/prototype-utils.css";
      ```

      `prototype-utils.css` (in `apps/web/design/`) defines every class this plan names: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-icon`, `.field`, `.field-label`, `.field-hint`, `.field-error`, `.input`, `.select`, `.radio`, `.choice`, `.is-invalid`, `.card`, `.grid`, `.stack`, `.stack-lg`, `.stack-sm`, `.tabs`/`.tab`, `.backdrop`, `.drawer`, `.toast`, `.alert`, `.alert-danger`, `.empty-state`, `.skeleton`, `.sr-only`, `.text-muted`, `.text-sm`. The page-level rules the prototype keeps in its own inline `<style>` (`.page-head`, `.stat`, `.card-head`, `.table`, `.table-wrap`, `.table .num`, `.drawer` flex column, `.drawer-head`, `.drawer fieldset`, `.drawer legend`, `.drawer-actions`, `.skel-grid`, `.skel-card`, `.skel-tall`, `.skel-wide`, `.skel-short`, `.error-actions`, `.alert > div`, `.icon`) are not in `prototype-utils.css`, so port them into `apps/web/src/features/dashboard/dashboard.css` using the same tokens (`--space-*`, `--font-size-*`, `--font-weight-*`, `--color-*`, `--border-width`, `--size-skeleton`, `--size-icon`). The shell rules (`.shell`, `.shell-header`, `.shell-brand`, `.shell-menu-btn`, `.shell-nav`, `.shell-link`, `.shell-layout`, `.shell-footer`, the 48rem breakpoint) go into `apps/web/src/components/shell.css` the same way (copy from the prototype's `data-arc-shell-style` block, cross-checking `apps/web/design/app-shell.html`). No hex, rgb or raw pixel literal; the 48rem and 60rem media-query widths cannot use tokens and are the prototype's own values.
    files:
      - apps/web/src/index.css
      - apps/web/src/features/dashboard/dashboard.css
      - apps/web/src/components/shell.css
    rationale: |
      The app does not load the tokens yet (`src/main.tsx` imports only `./index.css`, which imports only Tailwind; `vite.config.ts` has no theme mapping). Importing once in the entry stylesheet makes every later UI step token-only.

  - description: |
      Core API data model and migration. New `apps/api`-side files under `services/api`:

      - `app/models.py` (SQLAlchemy 2.0 declarative): `Item(id Uuid pk, organisation_id Uuid not null indexed, name str not null, bin str not null, on_hand int not null default 0, CheckConstraint("on_hand >= 0"))` and `StockMovement(id Uuid pk, organisation_id Uuid not null indexed, item_id fk items.id not null, direction str not null ("in" or "out"), quantity int not null with CheckConstraint("quantity > 0"), occurred_at timestamptz not null)`.
      - Alembic: `services/api/alembic.ini`, `services/api/migrations/env.py`, `services/api/migrations/versions/0001_items_and_stock_movements.py` creating both tables (with a working `downgrade`). The directory is deliberately named `migrations`, not `alembic`: pytest runs with `pythonpath = ["."]`, and a top-level `alembic/` folder would shadow the installed `alembic` package.
      - `app/db.py`: keep `make_engine()`, add a lazily built `SessionLocal` and `get_session()` FastAPI dependency (yield a `Session`, close in `finally`).
      - `app/tenancy.py`: `def current_organisation_id() -> UUID` returning `settings.default_organisation_id`; add `default_organisation_id: UUID` to `Settings` in `app/config.py` (env `API_DEFAULT_ORGANISATION_ID`). Every query below filters on it (ADR-0009). See open question on auth.
    files:
      - services/api/app/models.py
      - services/api/app/db.py
      - services/api/app/config.py
      - services/api/app/tenancy.py
      - services/api/alembic.ini
      - services/api/migrations/env.py
      - services/api/migrations/versions/0001_items_and_stock_movements.py
      - services/api/pyproject.toml
    rationale: |
      ADR-0002/0003/0009: only the Core API touches PostgreSQL, tenant-owned tables carry `organisation_id`, and every query is filtered by it. A DB-level `on_hand >= 0` check backs the service's own check (AC 8) against concurrent writers.

  - description: |
      Core API recording service and endpoints.

      `app/services/stock.py`:

      ```python
      class ItemNotFound(Exception): ...
      class InsufficientStock(Exception):
          def __init__(self, on_hand: int) -> None: ...

      def record_movement(
          session: Session, organisation_id: UUID, item_id: UUID,
          direction: Literal["in", "out"], quantity: int,
      ) -> StockMovement: ...
      ```

      It loads the item with `select(Item).where(Item.id == item_id, Item.organisation_id == organisation_id).with_for_update()`, raises `ItemNotFound` if absent, raises `InsufficientStock(item.on_hand)` when `direction == "out" and quantity > item.on_hand`, otherwise adjusts `item.on_hand`, inserts the `StockMovement` (`occurred_at = datetime.now(UTC)`) and commits in one transaction.

      `app/schemas.py`: `MovementCreate(item_id: UUID, quantity: int = Field(gt=0), direction: Literal["in","out"])`, `MovementRead`, `ItemRead(id, name, bin, on_hand)`, `DashboardRead(items_in_stock: int, movements_today: int, item_count: int, recent_movements: list[RecentMovement])`.

      Routers (each `include_router`ed in `app/main.py`):
      - `GET /items` returns the caller organisation's items ordered by name (the drawer's item choices and each item's `on_hand` for the client-side check).
      - `GET /dashboard` returns `items_in_stock` (sum of `on_hand`), `movements_today` (count with `occurred_at` on today's UTC date), `item_count`, and the 10 most recent movements joined to item name and bin.
      - `POST /stock-movements` returns 201 with the movement; 404 `{"detail": {"code": "item_not_found"}}`; 409 `{"detail": {"code": "insufficient_stock", "on_hand": n}}`; 422 from Pydantic for quantity of zero or less or a bad direction. Transfers between warehouses are not accepted (no warehouse field), per scope.
    files:
      - services/api/app/services/__init__.py
      - services/api/app/services/stock.py
      - services/api/app/schemas.py
      - services/api/app/routers/items.py
      - services/api/app/routers/dashboard.py
      - services/api/app/routers/stock_movements.py
      - services/api/app/main.py
    rationale: |
      The server is the source of truth for AC 3 (recorded movement), AC 4 (figures include it) and AC 8 (no negative stock); the client checks exist only for inline feedback. Service logic is separate from the routers so it can be unit tested without HTTP.

  - description: |
      Web App API layer and dev proxy. `apps/web/src/api/types.ts` (`Item`, `Dashboard`, `RecentMovement`, `NewMovement`) and `apps/web/src/api/client.ts`:

      ```ts
      export class ApiError extends Error {
        constructor(public status: number, public code?: string, public onHand?: number) { super(`API ${status}`) }
      }
      export function getDashboard(): Promise<Dashboard>
      export function getItems(): Promise<Item[]>
      export function recordMovement(m: NewMovement): Promise<void>  // throws ApiError on non-2xx
      ```

      Calls go to relative `/api/...`. `vite.config.ts` adds `server.proxy` and `preview.proxy` mapping `/api` to `process.env.API_PROXY_TARGET ?? 'http://localhost:8000'` with the `/api` prefix stripped, so no CORS is needed and the browser only reaches data through the API (ADR-0001). Production ingress routing of `/api` is a deployment concern (open question).
    files:
      - apps/web/src/api/types.ts
      - apps/web/src/api/client.ts
      - apps/web/vite.config.ts
    rationale: |
      ADR-0001: screens reach data only through the API. A relative base keeps one build usable in every environment.

  - description: |
      Validation and drawer. `apps/web/src/features/dashboard/validateMovement.ts`:

      ```ts
      export type MovementDraft = { itemId: string; quantity: string; direction: 'in' | 'out' }
      export type MovementErrors = { item?: string; quantity?: string }
      export function validateMovement(d: MovementDraft, items: Item[]): MovementErrors
      ```

      Messages (sentence case, say what happened and how to fix, as the prototype and UI guidelines do): no item gives "Choose the item that moved."; quantity not a whole number of 1 or more gives "Enter a quantity of 1 or more, like 24."; outgoing quantity above the item's `on_hand` gives "Only 3 on hand. Enter 3 or fewer." (with the real number).

      `MovementDrawer.tsx` follows the prototype's `#movement-drawer`: a `.backdrop` plus `<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby>`; `.drawer-head` with `<h2>Record movement</h2>` and a `.btn .btn-ghost .btn-icon` close button (`aria-label="Close record movement"`, X icon); `<form noValidate>` with a `.field` Item `<select class="select">` ("Choose an item" empty option, then the items from `getItems()`), a `.field` Quantity `<input class="input" type="number" inputMode="numeric" min="1">` with the `.field-hint` "Whole units, at least 1.", a `<fieldset><legend>Direction</legend>` of two `.choice` radios ("Goods in" default, "Goods out"), and `.drawer-actions` with `.btn-secondary` "Cancel" and the one `.btn-primary` "Save movement". Errors render in `.field-error role="alert"` beside the field with `.is-invalid` and `aria-invalid` on the control, wired through `aria-describedby`; the first invalid control gets focus.

      Behaviour: invalid submit sets errors and does nothing else, so the drawer stays open and the values are kept (AC 6 to 9). Valid submit disables the button and shows "Saving…", calls `recordMovement`, then on success calls `onSaved()` and closes (AC 5); the form resets only on success. A server 409 `insufficient_stock` maps to the inline quantity error (AC 8, a race with another user); any other failure leaves the drawer open with values kept and shows an `.alert .alert-danger role="alert"` at the top of the form: "The movement could not be saved. Check your connection, then try again. Your stock figures have not changed." (AC 10, 11). Escape and backdrop click close it; focus moves to the first field on open and returns to the Record movement button on close; Tab is kept inside while open. Items load when the drawer first opens; a load failure shows the same alert style inside the drawer with "Try again".
    files:
      - apps/web/src/features/dashboard/validateMovement.ts
      - apps/web/src/features/dashboard/MovementDrawer.tsx
    rationale: |
      Mirrors the prototype's drawer markup and error copy. UI guidelines: use `.drawer` for editing a record, `.field-error` plus `.is-invalid` next to the control, `.alert` (not `.toast`) for a problem that stays, one `.btn-primary`.

  - description: |
      Dashboard page, toast and shell. Replace the placeholder `App.tsx` with `<AppShell><DashboardPage /></AppShell>`.

      - `components/AppShell.tsx`: top bar from the prototype: brand "Comp", "Menu" button below 48rem toggling `#main-nav`, section links Overview (`data-nav-key="overview"`, `aria-current="page"`), Items, Reports, Settings, and Account at the right (`data-nav-key="account"`); `.shell-layout` main column up to `--size-container`; footer with Help and Privacy. Links other than Overview are inert `href="#"` placeholders because those sections do not exist yet.
      - `features/dashboard/useDashboard.ts`: `{ data, status: 'loading' | 'error' | 'ready', refetch }`. `refetch()` keeps the old data on screen while loading (no skeleton flash) and, if the refresh fails, keeps the old figures and surfaces an error toast so the Dashboard is not wiped.
      - `features/dashboard/DashboardPage.tsx`: states as in the prototype. Loading: `.skeleton` blocks with `role="status" aria-busy` and sr-only "Loading warehouse overview…". Error: `.alert-danger` "The warehouse overview could not be loaded." with a "Try again" `.btn-secondary`. Empty (`item_count === 0`): `.empty-state` "No stock recorded yet" with one `.btn-primary` "Add first item". Default: `.page-head` (h1 "Warehouse overview", muted "Stock and movements across all bins, today.", and the `.btn-primary` "Record movement" with plus icon, `aria-haspopup="dialog"`); a `.grid` with `aria-live="polite"` holding two `.card` stats, "Items in stock" and "Movements today", numbers formatted with `toLocaleString`; and a `.card` "Recent movements" with the `.table` (Time, Item, Bin, Type, Qty, Qty right-aligned) and the All / Goods in / Goods out `.tab` filter. The Dashboard remains the page shown behind the drawer (AC 1); there is no route change.
      - `features/dashboard/Toast.tsx`: `.toast role="status"`, auto-hides after 4 seconds; shown with "Movement saved. Figures updated." after a successful save.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/components/AppShell.tsx
      - apps/web/src/features/dashboard/DashboardPage.tsx
      - apps/web/src/features/dashboard/useDashboard.ts
      - apps/web/src/features/dashboard/Toast.tsx
    rationale: |
      AC 1 and 4 need a real Dashboard to open the drawer over and to refresh. The two figures are the ones the prototype notes say saving updates; the recent list is there so the user can see the movement they just recorded.

  - description: |
      Dev seed. `services/api/app/seed.py` with `python -m app.seed` inserting a handful of items for `settings.default_organisation_id` only when that organisation has none (idempotent). Needed so a fresh environment has items to choose in the drawer; item creation itself belongs to the Items section and is not in this story.
    files:
      - services/api/app/seed.py
    rationale: |
      Without items the drawer has nothing to select and the Dashboard shows the empty state. See open question on where real items come from.

tests:
  - |
    Write these first, each failing before its code. Narrow forms of the project test command (`(cd services/api && uv run pytest tests/unit) && (cd apps/web && pnpm test)`):
    `(cd services/api && uv run pytest tests/unit/test_stock_service.py tests/unit/test_stock_api.py)` and `(cd apps/web && pnpm test src/features/dashboard)`.
    API unit tests use an in-memory SQLite engine (`StaticPool`) built from `Base.metadata.create_all` in `services/api/tests/unit/conftest.py`, with `app.dependency_overrides[get_session]` and `[current_organisation_id]`. Web tests mock `src/api/client` with `vi.mock`.
  - |
    AC 1 (apps/web/src/features/dashboard/DashboardPage.test.tsx): the Dashboard stays the page while the drawer is open.
    ```tsx
    await user.click(await screen.findByRole('button', { name: /record movement/i }))
    expect(screen.getByRole('dialog', { name: 'Record movement' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Warehouse overview' })).toBeInTheDocument()
    ```
  - |
    AC 2 (MovementDrawer.test.tsx): the form shows the three controls.
    ```tsx
    expect(screen.getByLabelText('Item')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Goods in' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Goods out' })).not.toBeChecked()
    ```
  - |
    AC 3, web (MovementDrawer.test.tsx): the client is called with exactly the entered values.
    ```tsx
    await user.selectOptions(screen.getByLabelText('Item'), 'item-a-id')
    await user.type(screen.getByLabelText('Quantity'), '5')
    await user.click(screen.getByRole('button', { name: 'Save movement' }))
    expect(recordMovement).toHaveBeenCalledWith({ itemId: 'item-a-id', quantity: 5, direction: 'in' })
    ```
    AC 3, API (tests/unit/test_stock_service.py and test_stock_api.py):
    ```python
    mv = record_movement(session, ORG, item_a.id, "in", 5)
    assert (mv.item_id, mv.quantity, mv.direction) == (item_a.id, 5, "in")
    resp = await client.post("/stock-movements", json={"item_id": str(item_a.id), "quantity": 5, "direction": "in"})
    assert resp.status_code == 201
    assert resp.json()["quantity"] == 5 and resp.json()["direction"] == "in"
    ```
  - |
    AC 4, API (test_stock_api.py): the dashboard includes the movement; another organisation's data is excluded (ADR-0009).
    ```python
    before = (await client.get("/dashboard")).json()
    await client.post("/stock-movements", json={"item_id": str(item_a.id), "quantity": 5, "direction": "in"})
    after = (await client.get("/dashboard")).json()
    assert after["items_in_stock"] == before["items_in_stock"] + 5
    assert after["movements_today"] == before["movements_today"] + 1
    assert after["recent_movements"][0]["item_name"] == "Item A"
    ```
    AC 4, web (DashboardPage.test.tsx): after save, `getDashboard` is called a second time and the new figure is shown with no page reload.
    ```tsx
    expect(await screen.findByText('1,284')).toBeInTheDocument()
    // fill and save; getDashboard mock now resolves items_in_stock: 1289
    expect(await screen.findByText('1,289')).toBeInTheDocument()
    expect(getDashboard).toHaveBeenCalledTimes(2)
    ```
  - |
    AC 5 (DashboardPage.test.tsx): the drawer closes after a successful save, and the toast appears.
    ```tsx
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Movement saved. Figures updated.')
    ```
  - |
    AC 6 (validateMovement.test.ts and MovementDrawer.test.tsx): no item blocks the save with an inline error beside the item field.
    ```ts
    expect(validateMovement({ itemId: '', quantity: '5', direction: 'in' }, items).item).toBe('Choose the item that moved.')
    ```
    ```tsx
    await user.click(screen.getByRole('button', { name: 'Save movement' }))
    expect(recordMovement).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Item')).toHaveAccessibleDescription(/Choose the item that moved\./)
    expect(screen.getByLabelText('Item')).toHaveAttribute('aria-invalid', 'true')
    ```
  - |
    AC 7 (validateMovement.test.ts, MovementDrawer.test.tsx, test_stock_api.py): zero and negative quantities are blocked beside the quantity field, and the API also refuses them.
    ```ts
    for (const q of ['0', '-3', '']) {
      expect(validateMovement({ itemId: 'a', quantity: q, direction: 'in' }, items).quantity)
        .toBe('Enter a quantity of 1 or more, like 24.')
    }
    ```
    ```python
    for q in (0, -3):
        resp = await client.post("/stock-movements", json={"item_id": str(item_a.id), "quantity": q, "direction": "in"})
        assert resp.status_code == 422
    ```
  - |
    AC 8 (validateMovement.test.ts, MovementDrawer.test.tsx, test_stock_service.py, test_stock_api.py): item A has 3 on hand, an outgoing 5 is blocked.
    ```ts
    expect(validateMovement({ itemId: 'a', quantity: '5', direction: 'out' }, [{ id: 'a', name: 'Item A', bin: 'A-01', on_hand: 3 }]).quantity)
      .toBe('Only 3 on hand. Enter 3 or fewer.')
    ```
    ```python
    with pytest.raises(InsufficientStock) as exc:
        record_movement(session, ORG, item_a.id, "out", 5)   # item_a.on_hand == 3
    assert exc.value.on_hand == 3 and item_a.on_hand == 3     # unchanged, no movement row
    resp = await client.post("/stock-movements", json={"item_id": str(item_a.id), "quantity": 5, "direction": "out"})
    assert resp.status_code == 409 and resp.json()["detail"]["code"] == "insufficient_stock"
    ```
    Also a web test that a server 409 (`new ApiError(409, 'insufficient_stock', 3)`) shows the inline quantity error and keeps the drawer open. Plus a tenancy test that an item of another organisation gives 404.
  - |
    AC 9 (MovementDrawer.test.tsx): after any blocked save the drawer stays open and the values are kept.
    ```tsx
    await user.type(screen.getByLabelText('Quantity'), '0')
    await user.click(screen.getByRole('button', { name: 'Save movement' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity')).toHaveValue(0)
    expect(screen.getByRole('radio', { name: 'Goods out' })).toBeChecked() // after choosing out first
    ```
  - |
    AC 10 (MovementDrawer.test.tsx): a failed save keeps the drawer open and the values.
    ```tsx
    recordMovement.mockRejectedValueOnce(new ApiError(500))
    // fill item A, 5, out; click Save movement
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity')).toHaveValue(5)
    expect(screen.getByLabelText('Item')).toHaveValue('item-a-id')
    expect(screen.getByRole('button', { name: 'Save movement' })).toBeEnabled()
    ```
  - |
    AC 11 (MovementDrawer.test.tsx): the failure message is inside the drawer.
    ```tsx
    const alert = await within(screen.getByRole('dialog')).findByRole('alert')
    expect(alert).toHaveTextContent('The movement could not be saved.')
    ```
  - |
    Dashboard states and shell (DashboardPage.test.tsx, App.test.tsx): replaces the old "Web App" heading test. Loading shows the status "Loading warehouse overview…"; a rejected `getDashboard` shows "The warehouse overview could not be loaded." and "Try again" refetches; `item_count: 0` shows "No stock recorded yet"; the Overview link has `aria-current="page"`.
  - |
    Playwright (apps/web/e2e/app.spec.ts, replacing the "Web App" heading check): `page.route('**/api/**', ...)` serves `/api/dashboard`, `/api/items` and `POST /api/stock-movements` from an in-test state object (the preview server has no API). Flow: open `/`, click "Record movement", save empty and see the item error, choose Item A, enter 5, choose Goods in, Save movement, then assert the drawer is gone, the "Items in stock" figure rose by 5 and the Dashboard heading is still visible. A second test makes the POST return 500 and asserts the in-drawer alert and kept values.
  - |
    Migration check (tests/unit/test_models.py): `Base.metadata.create_all` on SQLite, then inserting an `Item` with `on_hand=-1` or a movement with `quantity=0` raises `IntegrityError`; `alembic upgrade head` then `downgrade base` against Postgres is run by the implementer once locally and noted in the PR.

assumptions_or_open_questions:
  - |
    Nothing for this story exists in the repo. I looked at `apps/web/src` (placeholder `App.tsx`, no router, no API client), `services/api/app` (only `health.py`, `db.py`, `config.py`) and `services/api/tests`: no items, stock, dashboard, migrations, Alembic, or auth. The plan therefore creates the data layer. If another story is meant to supply items and the Dashboard first, this plan should be rebased on it; the reviewer should confirm.
  - |
    Authentication and organisation. ADR-0004 and ADR-0009 require Cognito tokens and org-scoped queries, but no token verification exists in the Core API. The plan adds a single seam `current_organisation_id()` returning a configured default organisation (`API_DEFAULT_ORGANISATION_ID`) and filters every query on it, so real auth swaps in at one place. This is a stopgap, not secure multi-tenant access. Confirm this is acceptable or that an auth story lands first. There is also no `organisations` table, so `organisation_id` is a plain indexed column with no foreign key.
  - |
    Items source. The drawer needs items, and item creation is a different section (the prototype's "Add first item" and "View all items" exit to the Items section, built elsewhere). I plan only `GET /items`, a dev seed script, and an "Add first item" button that does nothing yet (inert placeholder, like the other nav links) in the empty state. Confirm, or split an "Items" story.
  - |
    Dashboard scope narrowed. The prototype also shows "Low-stock items" and "Orders awaiting pick" tiles, a 30-day chart, Low stock list, and an "Items sent to warehouses" transfers table. The story only requires the figures a movement changes; those other parts have no data source and need their own work (transfers are explicitly not recorded here). They are left out rather than shown with invented data. Say so if you want them in this item.
  - |
    "Items in stock" is the sum of units on hand across items (the prototype's 1,284 moves by exactly the quantity saved), and "Movements today" counts movements on the current UTC date. Warehouse-local time zones and multiple bins per item are not modelled; confirm.
  - |
    Design gaps. (1) The prototype shows no save-failure state; AC 11 requires one, so I use `.alert .alert-danger` inside the drawer, which the UI guidelines prescribe for problems that stay (a toast must not carry the only copy). (2) The prototype's out-of-stock rule (AC 8) has no message; I wrote "Only 3 on hand. Enter 3 or fewer." in the prototype's voice. (3) The prototype's chart and the shell's other sections are placeholders, as above.
  - |
    Design tokens file bug. `apps/web/design/tokens.css` (lines 70 to 72) holds `--duration-fast: [object Object]`, and likewise `--duration-spin` and `--duration-pulse` (the prototype has the same). Those declarations are invalid, so button transitions and the skeleton pulse animation silently do nothing. I did not plan a fix, because it comes from the token generator and the file is "auto-generated, do not edit"; no step relies on those tokens for behaviour. Flagging so the design-system owner can fix `tokens.json`.
  - |
    Production routing of `/api` to the Core API (ingress or reverse proxy) is not in the repo; dev and preview use the Vite proxy. A deployment owner must route `/api` with the prefix stripped, or the base can be changed in `src/api/client.ts`.
  - |
    No Playwright run against a real API: the e2e check mocks `/api/**`. Real HTTP coverage is the ASGI-transport pytest tests; SQLite stands in for PostgreSQL in unit tests, so the `FOR UPDATE` lock and the DB check constraints are only truly exercised on PostgreSQL (the one manual migration run).

estimated_points: 8

package_dependencies:
  - name: alembic
    version: ">=1.14"
    ecosystem: pip
    rationale: |
      Schema migrations for the new items and stock_movements tables (Core API, PostgreSQL). Not currently a dependency in services/api/pyproject.toml.
    component_id: comp_core_api
  - name: "@testing-library/user-event"
    version: "^14.5.0"
    ecosystem: npm
    rationale: |
      Dev dependency for the drawer and Dashboard component tests (typing, selecting options, clicking, keyboard Escape/Tab). Only @testing-library/react and jest-dom are installed today.
    component_id: comp_web_app

notes: |
  ### Data & rollout

  - **Existing data**: None to migrate. Migration `0001_items_and_stock_movements` only creates two new tables; no existing table or row changes. `organisation_id` is NOT NULL on both new tables, but they start empty.
  - **Backfill / seed**: No backfill. A dev seed (`cd services/api && uv run python -m app.seed`) inserts sample items for the default organisation only if it has none, so it is idempotent and safe to re-run. Real items are expected from the Items section (open question).
  - **Settings**: `API_DEFAULT_ORGANISATION_ID` (Core API; a UUID; the stopgap for the caller's organisation until auth exists; no safe unset default in production, so give the setting a fixed development UUID default and set it explicitly in deployed environments; document it in `services/api/app/config.py`). `API_PROXY_TARGET` (Vite dev/preview only, default `http://localhost:8000`, read in `apps/web/vite.config.ts`). Alembic reads the existing `API_DATABASE_URL`.
  - **Provisioning**: PostgreSQL schema created by `cd services/api && uv run alembic upgrade head`; `/api` routing to the Core API in deployed environments; seed or real items so the drawer has choices.
  - **Order and rollback**: Run the migration before deploying the new API (the new endpoints read the new tables); deploy the API before the Web App (the new UI calls the new endpoints). Rollback: `alembic downgrade base` drops both tables (they hold only data created by this feature), or leave them in place, as they are additive and unused by the old code.

  ### Design facts used (read from the approved prototype)

  Top-bar shell with the Overview link current; `.page-head` with h1 "Warehouse overview" and the single `.btn-primary` "Record movement" (`data-open="movement-drawer"`); stat `.card`s (`.stat` uses `--font-size-xl`, `--font-weight-bold`); `.drawer` (width `min(var(--size-drawer), 100%)`, padding `--space-4`) with `.backdrop`; form `.field`s with `.select`, `.input`, `.field-hint`, `.field-error`, `.is-invalid`; direction as `.choice` radios in a fieldset; `.toast` "Movement saved. Figures updated."; `.skeleton`, `.empty-state`, `.alert-danger` for loading, empty and error. Tokens named: `--space-1..4`, `--color-fg`, `--color-fg-muted`, `--color-border`, `--color-danger`, `--color-primary`, `--color-info-bg`, `--color-info`, `--radius-md`, `--font-size-sm/lg/xl`, `--size-container`, `--size-drawer`, `--size-tap`, `--size-skeleton`, `--size-icon`, `--z-overlay/modal/toast`.

  ### Structure

  ```mermaid
  flowchart TD
    main_tsx[main.tsx] --> App[App.tsx]
    main_tsx --> index_css[index.css: loads tokens and prototype-utils]
    App --> AppShell[AppShell.tsx: top bar]
    AppShell --> DashboardPage[DashboardPage.tsx: states and figures]
    DashboardPage --> useDashboard[useDashboard.ts: refetch after save]
    DashboardPage --> MovementDrawer[MovementDrawer.tsx: form and errors]
    MovementDrawer --> validateMovement[validateMovement.ts: AC 6 to 8]
    useDashboard --> client[api/client.ts]
    MovementDrawer --> client
    client -->|"/api proxy"| vite_config[vite.config.ts]
    vite_config --> main_py[app/main.py]
    main_py --> dashboard_router[routers/dashboard.py]
    main_py --> items_router[routers/items.py]
    main_py --> movements_router[routers/stock_movements.py]
    movements_router --> stock_service[services/stock.py: atomic record]
    dashboard_router --> models[models.py]
    items_router --> models
    stock_service --> models
    models --> db_py[db.py: session]
    models --> migration[migrations 0001]

    classDef touched fill:#f96,color:#000
    class App,index_css,AppShell,DashboardPage,useDashboard,MovementDrawer,validateMovement,client,vite_config,main_py,dashboard_router,items_router,movements_router,stock_service,models,db_py,migration touched
  ```

  Orange nodes are created or changed; `main.tsx` is the existing entry that already imports `App` and `index.css`.

review_focus: |
  IN: the Record movement drawer (AC 1 to 11) end to end, with the Core API data model, migration, endpoints and the minimum Dashboard (loading, error, empty, the two updated figures, recent movements) needed to show the effect. OUT: transfers between warehouses, items management, the chart, Low stock, the Low-stock and Orders tiles, and real authentication. Riskiest areas: the stock-never-negative rule under concurrent writes (row lock plus DB check, only truly exercised on PostgreSQL) and the stopgap `current_organisation_id()` seam standing in for Cognito-based tenancy. Deliberate: the `migrations/` folder name (avoids shadowing the `alembic` package under `pythonpath = ["."]`), client-side checks that duplicate the server's rules for inline feedback, and the in-drawer `.alert` for failures because the prototype has no failure state.
