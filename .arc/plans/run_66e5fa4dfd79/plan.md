summary: |
  Give the Web App's Dashboard (the "Overview" screen, "Warehouse overview" in the approved prototype) three
  whole-content replacement states: loading (skeleton), empty ("No stock recorded yet" + "Add first item"),
  and error ("The warehouse overview could not be loaded." + "Try again"). A single `useDashboard` hook loads
  the Dashboard in ONE request to `GET /dashboard` through a small typed client, derives one of
  `loading | error | empty | ready`, and exposes `retry()`. Retry puts the screen back into loading and
  re-requests; success shows the normal view, failure shows the error state again. The repo is a bare
  scaffold (App.tsx is a "Web App" heading, the design tokens are not loaded, there is no Dashboard, no data
  endpoint), so this plan also loads the design system once and creates the Dashboard container. The normal
  Dashboard content (stats, chart, tables, drawer) and the top bar are other stories; here "ready" renders a
  minimal placeholder view.
scope:
  - description: |
      Load the design system once, in the app's entry stylesheet. After `@import "tailwindcss";` add
      `@import "../design/tokens.css";` and `@import "../design/prototype-utils.css";` (the second defines
      `.stack-lg`, `.stack-sm`, `.sr-only`, `.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.alert`,
      `.alert-danger`, `.empty-state`, `.skeleton`, `.text-muted` - all verified in that file). Also define,
      in the same index.css and only from tokens, the prototype's own inline classes the states use:
      `.skel-grid` (auto-fit grid, `gap: var(--space-3)`, `minmax(min(var(--size-grid-min), 100%), 1fr)`),
      `.skel-card` (flex column, `gap: var(--space-2)`), `.skel-tall` (`height: calc(var(--size-skeleton) * 10)`),
      `.skel-wide` (60% width), `.skel-short` (30% width), `.error-actions` (`margin-top: var(--space-2)`),
      `.alert > div` (flex column, `gap: var(--space-1)`, `align-items: flex-start`), `.icon`
      (`width/height: var(--size-icon)`).
    files:
      - apps/web/src/index.css
    rationale: |
      Today index.css only imports tailwindcss and main.tsx imports index.css, so no token is available to
      any component. The classes come from prototype-utils.css (prototype lines 1005-1037 inline the same
      rules); the skel-* / error-actions rules exist only in the prototype's inline style (lines 1077-1083),
      so they are defined in the app on the same tokens.
  - description: |
      Typed Dashboard client. `apps/web/src/dashboard/api.ts` exports
      `export interface DashboardSummary { itemCount: number }` and
      `export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardSummary>`.
      It calls `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/dashboard`, throws on a non-2xx status or a
      network error, and maps the JSON `{ "item_count": number }` to `DashboardSummary`.
      In `vite.config.ts` add `server.proxy` for `/api` -> `http://localhost:8000` with the `/api` prefix
      stripped, so the dev server reaches the Core API (ADR-0001: screens reach data only through the API).
    files:
      - apps/web/src/dashboard/api.ts
      - apps/web/vite.config.ts
    rationale: |
      One request, one failure mode: any failure of that request is the whole-Dashboard error state, so
      there is no partial-failure rendering (answers the deferred question).
  - description: |
      State hook `apps/web/src/dashboard/useDashboard.ts`:
      `export type DashboardState = { status: 'loading' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; summary: DashboardSummary }`
      `export function useDashboard(load = fetchDashboard): DashboardState & { retry: () => void }`.
      On mount and on `retry()` it sets `loading`, calls `load(signal)`, then sets `empty` when
      `itemCount === 0`, `ready` otherwise, `error` on rejection. A new request aborts the previous one and a
      response from an aborted or unmounted request is ignored, so a late response cannot overwrite a newer
      state (React StrictMode double-mount safe).
    files:
      - apps/web/src/dashboard/useDashboard.ts
    rationale: |
      Keeps the four-state logic out of the components so it is unit-tested without rendering.
  - description: |
      Presentational states, each replacing ALL Dashboard content (they are rendered instead of, never beside,
      the normal view):
      - `DashboardLoading.tsx`: `<div className="stack-lg" role="status" aria-busy="true">` with
        `<span className="sr-only">Loading warehouse overview…</span>`, a `.stack-sm` of two `.skeleton`
        spans (`.skel-short`, `.skel-wide`), a `.skel-grid` of four `.card.skel-card` (a `.skeleton` plus a
        `.skeleton.skel-short`), a `.card` with a `.skeleton.skel-tall`, and a `.card.skel-card` with four
        `.skeleton` rows (prototype lines 1324-1337).
      - `DashboardEmpty.tsx`: `<div className="empty-state">` with `<h3>No stock recorded yet</h3>`,
        `<p>No stock has been recorded in this warehouse yet. Add your first item to start tracking stock and movements.</p>`
        and one `<button type="button" className="btn btn-primary">Add first item</button>` calling the
        `onAddFirstItem: () => void` prop (prototype lines 1339-1345).
      - `DashboardError.tsx`: `<div className="alert alert-danger" role="alert">` with an `aria-hidden` alert
        icon (`.icon`), `<strong>The warehouse overview could not be loaded.</strong>`,
        `<span>Check your connection, then try again. Your stock data has not changed.</span>` and
        `<div className="error-actions"><button type="button" className="btn btn-secondary">Try again</button></div>`
        calling `onRetry: () => void` (prototype lines 1347-1356). The copy follows the UI guidelines: says what
        happened and the next step, without blame. Only `.btn-primary` is on the empty state; the error state
        uses `.btn-secondary`, as drawn, so there is one primary button per screen.
    files:
      - apps/web/src/dashboard/DashboardLoading.tsx
      - apps/web/src/dashboard/DashboardEmpty.tsx
      - apps/web/src/dashboard/DashboardError.tsx
    rationale: |
      Markup and copy are taken from the three non-default states of the approved prototype (Dashboard screen).
      Styling is only through design-system classes, which use tokens by name (`--space-*`, `--color-*`,
      `--size-skeleton`, `--size-spinner`, `--radius-*`). No colour or pixel literals are added.
  - description: |
      Dashboard container `apps/web/src/dashboard/Dashboard.tsx`:
      `export default function Dashboard({ onAddFirstItem, load }: { onAddFirstItem: () => void; load?: typeof fetchDashboard })`.
      Calls `useDashboard(load)` and switches on `status`: loading -> `DashboardLoading`, empty ->
      `DashboardEmpty`, error -> `DashboardError` (with `onRetry={retry}`), ready -> `DashboardView`, a
      minimal placeholder (`<h1>Warehouse overview</h1>` and the muted line "Stock and movements across all
      bins, today.") standing in for the normal view that another story builds. `App.tsx` renders
      `<Dashboard onAddFirstItem={...} />` inside `<main>` using the shell layout width
      (`max-width: var(--size-container)`, centred, `padding: var(--space-4) var(--space-3)`), replacing the
      "Web App" heading. `onAddFirstItem` is a prop and App passes a no-op until the top bar / links story
      supplies the navigation target (out of scope per the item).
    files:
      - apps/web/src/dashboard/Dashboard.tsx
      - apps/web/src/dashboard/DashboardView.tsx
      - apps/web/src/App.tsx
    rationale: |
      The only Dashboard code today is none; the container is the single place that guarantees "replaces all
      Dashboard content". Nothing is faked: ready content is a labelled placeholder, not invented data.
  - description: |
      Update the two existing tests that assert the old "Web App" heading, and add the new ones listed under
      `tests`. `App.test.tsx` now stubs `fetch` and asserts the Dashboard loading state renders; the
      Playwright spec mocks `GET **/api/dashboard` with `page.route`.
    files:
      - apps/web/src/App.test.tsx
      - apps/web/src/dashboard/Dashboard.test.tsx
      - apps/web/src/dashboard/useDashboard.test.ts
      - apps/web/e2e/app.spec.ts
      - apps/web/e2e/dashboard-states.spec.ts
    rationale: |
      TDD order: write these first and watch them fail, then add the code above.
tests:
  - |
    AC1 loading, apps/web/src/dashboard/Dashboard.test.tsx. Write first. `load` never resolves:
    ```tsx
    const load = vi.fn(() => new Promise<never>(() => {}))
    render(<Dashboard onAddFirstItem={() => {}} load={load} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading warehouse overview…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Warehouse overview' })).not.toBeInTheDocument()
    ```
    (Dashboard takes an optional `load` prop passed to `useDashboard`, default `fetchDashboard`, so tests need no fetch stub.)
  - |
    AC2 empty replaces everything:
    ```tsx
    render(<Dashboard onAddFirstItem={() => {}} load={() => Promise.resolve({ itemCount: 0 })} />)
    expect(await screen.findByRole('heading', { name: 'No stock recorded yet' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Warehouse overview' })).not.toBeInTheDocument()
    ```
  - |
    AC3 'Add first item' button, same file:
    ```tsx
    const onAdd = vi.fn()
    render(<Dashboard onAddFirstItem={onAdd} load={() => Promise.resolve({ itemCount: 0 })} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add first item' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
    ```
  - |
    AC4 error replaces everything:
    ```tsx
    render(<Dashboard onAddFirstItem={() => {}} load={() => Promise.reject(new Error('boom'))} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The warehouse overview could not be loaded.')
    expect(screen.queryByRole('heading', { name: 'Warehouse overview' })).not.toBeInTheDocument()
    ```
  - |
    AC5 'Try again' shown:
    ```tsx
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    ```
  - |
    AC6 retry succeeds, same file:
    ```tsx
    const load = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ itemCount: 3 })
    render(<Dashboard onAddFirstItem={() => {}} load={load} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Warehouse overview' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
    ```
  - |
    AC7 retry fails again:
    ```tsx
    const load = vi.fn().mockRejectedValue(new Error('x'))
    render(<Dashboard onAddFirstItem={() => {}} load={load} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
    ```
  - |
    Hook, apps/web/src/dashboard/useDashboard.test.ts (renderHook): status goes `loading` then `empty` for
    `{ itemCount: 0 }` and `ready` for `{ itemCount: 2 }`; `retry()` returns the status to `loading` before the second
    result; a slow first response that resolves after a second request started is ignored:
    `expect(result.current.status).toBe('ready')` after the stale promise resolves with `{ itemCount: 0 }`.
  - |
    Client, apps/web/src/dashboard/api.test.ts: with `vi.stubGlobal('fetch', ...)` returning `{ ok: false, status: 500 }`,
    `await expect(fetchDashboard()).rejects.toThrow()`; with `{ ok: true, json: async () => ({ item_count: 4 }) }`,
    `await expect(fetchDashboard()).resolves.toEqual({ itemCount: 4 })`.
  - |
    Existing tests: App.test.tsx replaces `getByRole('heading', { name: 'Web App' })` with
    `expect(screen.getByRole('status')).toBeInTheDocument()` (fetch stubbed to a pending promise); e2e/app.spec.ts
    replaces the "Web App" heading check with the same loading-state check.
  - |
    Playwright, apps/web/e2e/dashboard-states.spec.ts, one test per path, mocking with
    `await page.route('**/api/dashboard', route => route.fulfill({ status: 500 }))` etc.:
    empty (`{"item_count":0}`) shows 'Add first item'; 500 shows 'Try again'; a route that fails once then succeeds with
    `{"item_count":3}` shows the heading 'Warehouse overview' after the click; a route that always fails shows 'Try again' again.
  - |
    Run narrowly: `cd apps/web && pnpm exec vitest run src/dashboard src/App.test.tsx`, then `pnpm typecheck`,
    then the e2e spec with `pnpm exec playwright test e2e/dashboard-states.spec.ts`.
assumptions_or_open_questions:
  - |
    DECISION NEEDED, backend scope. The Core API has only `GET /health` (services/api/app/routers/health.py): there is no
    items table, no migration tooling, no authentication or organisation id (ADR-0009), and no dashboard endpoint. This
    plan implements the Web App side against the contract `GET /dashboard -> 200 {"item_count": int}` and does NOT build
    the endpoint, because "has any data" needs an items model that is clearly bigger than this story. Without it the
    deployed Dashboard will always show the error state (404). Recommend splitting a story "Dashboard summary endpoint"
    (items table + migration, org-scoped count, pytest unit and e2e tests) and landing it first or together. If the
    reviewer instead wants it here, the points estimate rises to 8.
  - |
    Answer to the deferred question: the Dashboard loads in one request and refreshes only when the user presses
    'Try again' or reloads the page (no polling). A partial failure cannot occur on one request, so any failure shows the
    whole-Dashboard error state. If the normal Dashboard story later splits loading into several requests, it must still
    roll them into one status, because the acceptance criteria require the error state to replace all content.
  - |
    'No data' is defined as `item_count === 0`. Confirm that stock items (not movements or transfers) are the thing whose
    absence makes the Dashboard empty; the prototype's empty copy ("No stock recorded yet") implies that.
  - |
    The prototype names the screen "Warehouse overview" and talks about stock and bins; the project glossary was not in
    the context given to this plan. Copy is taken verbatim from the prototype; rename if the glossary uses other nouns.
  - |
    The normal Dashboard view (stats, 30-day chart, low stock, tables, record-movement drawer) and the top bar (Overview /
    Items / Reports / Settings / Account) are not in these acceptance criteria and are not built here. The ready state is a
    placeholder heading. 'Add first item' takes an `onAddFirstItem` callback; its navigation target (the Items section) belongs
    to the top bar and links story, so App wires a no-op for now. The prototype shows a toast instead; none is built.
  - |
    apps/web/design/tokens.css (lines 70-72) declares `--duration-fast`, `--duration-spin` and `--duration-pulse` as
    `[object Object]`, an invalid value produced by the token generator (the prototype's inlined copy has the same defect).
    Effect: skeleton pulse and spinner animations and button transitions are inert, and the loading state still renders. No
    token covers a working duration, so this plan hard-codes none; the token build should be fixed separately.
  - |
    prototype-utils.css also sets global `body`, `h1-h4`, `a` and `*` rules that overlap Tailwind's preflight; importing it
    after tailwindcss means the design system wins. Assumed intended since it is the approved design system.
  - |
    No `@testing-library/user-event` is in package.json. The plan uses `fireEvent`, so no new dependency is added.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: None. No schema, migration, stored data or seed changes in this plan.
  - **Settings**: one new optional Vite variable, `VITE_API_BASE_URL`, default `/api` (safe when unset). Document it in
    apps/web/README or a new apps/web/.env.example (no secrets). The dev proxy in vite.config.ts targets
    `http://localhost:8000`.
  - **Provisioning**: the Core API must serve `GET /dashboard` (see the open question) behind the same origin or proxy at `/api`
    in deployed environments (ADR-0001, ADR-0008). Until then the Dashboard shows the error state.
  - **Order and rollback**: web-only change; deploy after the endpoint exists. Rollback is a plain revert.

  ### Findings

  - Design tokens are NOT loaded today: apps/web/src/index.css is a single `@import "tailwindcss";` (line 1), imported by
    apps/web/src/main.tsx line 4; vite.config.ts uses `@tailwindcss/vite`. The scope adds the two design imports there.
  - Prototype elements used: states `loading` (lines 1324-1337), `empty` (1339-1345), `error` (1347-1356) of the "Dashboard"
    screen, each rendered instead of the `default` state block. The AC text matches the prototype, so there is no
    conflict between the two.
  - Accessibility from the prototype: loading `role="status" aria-busy="true"` with an `sr-only` label; error `role="alert"`;
    icon `aria-hidden`. Light theme only; phone-first, one column (`.skel-grid` auto-fits to one column at 375px).

  ```mermaid
  flowchart TD
    main[main.tsx] --> App[App.tsx]
    main --> css[index.css]
    css --> tokens[design/tokens.css]
    css --> utils[design/prototype-utils.css]
    App --> Dashboard[dashboard/Dashboard.tsx]
    Dashboard --> hook[dashboard/useDashboard.ts]
    hook --> api[dashboard/api.ts]
    api -->|GET /api/dashboard| core[Core API - endpoint not yet built]
    Dashboard --> L[DashboardLoading.tsx]
    Dashboard --> E[DashboardEmpty.tsx]
    Dashboard --> R[DashboardError.tsx]
    classDef touched fill:#f96,color:#000
    class App,css,Dashboard,hook,api,L,E,R touched
  ```
review_focus: |
  IN: the web-side whole-Dashboard loading, empty and error states, retry behaviour, and loading the design system once. OUT:
  the normal Dashboard view, the top bar and the 'Add first item' navigation target (a callback prop, no-op in App), and the
  Core API endpoint and items data model, which the plan flags as a decision (recommend a separate story). Riskiest part:
  the hook's retry/stale-response handling (an old response must not overwrite a newer state). Deliberate: the ready state is
  a labelled placeholder, and the invalid `[object Object]` duration tokens are reported, not worked around with literals.
