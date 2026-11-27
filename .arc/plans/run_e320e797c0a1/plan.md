summary: |
  Build the Dashboard's three whole-content replacement states in the Web App: loading (skeleton, announced as "Loading warehouse overview…"), empty (heading, explanation and an "Add first item" button) and error (danger alert with a "Try again" button that reloads and shows either the normal view or the error again). The Dashboard loads its data with ONE request through the Core API; any failure is one error state, with no partial rendering. The normal Dashboard view is outside this story's ACs, so it renders only a minimal "ready" view (heading and intro line). Today the Web App is a bare "Web App" heading, so this also loads the design tokens and component stylesheet once.
scope:
  - description: |
      Load the design system once in the app's entry stylesheet, after Tailwind. Add below `@import "tailwindcss";` in apps/web/src/index.css:
      `@import "../design/tokens.css";` and `@import "../design/prototype-utils.css";`.
      index.css today holds only the Tailwind import and main.tsx imports it; vite.config.ts uses the `@tailwindcss/vite` plugin, so no other mapping exists.
    files:
      - apps/web/src/index.css
    rationale: |
      The classes the states use (.skeleton, .empty-state, .alert, .alert-danger, .btn-primary, .btn-secondary, .card, .stack-lg, .stack-sm, .sr-only) are defined in apps/web/design/prototype-utils.css (verified by grep), which reads tokens from apps/web/design/tokens.css. Neither is loaded by the app yet.
  - description: |
      Dashboard data client, one request, typed result.
      ```ts
      export type DashboardData = { itemCount: number }
      export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData>
      ```
      It does `fetch('/api/dashboard', { signal })` and throws on a network error, a non-2xx status or a body that is not `{ itemCount: number }`. No partial data is ever returned.
    files:
      - apps/web/src/dashboard/api.ts
      - apps/web/src/dashboard/api.test.ts
    rationale: |
      Answers the deferred question: one request, all-or-nothing. ADR-0001 requires the Web App to reach data only through the API.
  - description: |
      State hook that owns load, empty, error and retry.
      ```ts
      export type DashboardState =
        | { status: 'loading' }
        | { status: 'empty' }
        | { status: 'error' }
        | { status: 'ready'; data: DashboardData }
      export function useDashboard(load = fetchDashboard): { state: DashboardState; retry: () => void }
      ```
      Starts as `loading`; `itemCount === 0` maps to `empty`, a rejection to `error`, anything else to `ready`. `retry` sets `loading` again, then repeats the request. A response arriving after unmount or after a newer attempt is ignored (AbortController plus an attempt counter), which also keeps React StrictMode double mount safe.
    files:
      - apps/web/src/dashboard/useDashboard.ts
      - apps/web/src/dashboard/useDashboard.test.tsx
    rationale: Keeps state logic testable without markup; the injected loader is the only test seam.
  - description: |
      Dashboard component rendering exactly one of four views, each REPLACING all Dashboard content (never beside it).
      ```tsx
      export default function Dashboard(props: { load?: typeof fetchDashboard; onAddFirstItem?: () => void }): JSX.Element
      ```
      Markup follows the prototype's states (data-arc-state loading, empty, error, default):
      - loading: `<div class="stack-lg" role="status" aria-busy="true">` with `<span class="sr-only">Loading warehouse overview…</span>`, a header block of two `.skeleton` bars (short 30%, wide 60%), a grid of four `.card` skeleton tiles, one tall `.card` skeleton and one `.card` with four `.skeleton` lines.
      - empty: `<div class="empty-state">` with `<h3>No stock recorded yet</h3>`, a paragraph "No stock has been recorded in this warehouse yet. Add your first item to start tracking stock and movements." and one `<button class="btn btn-primary">Add first item</button>` calling `onAddFirstItem`.
      - error: `<div class="alert alert-danger" role="alert">` with the alert icon, `<strong>The warehouse overview could not be loaded.</strong>`, `<span>Check your connection, then try again. Your stock data has not changed.</span>` and `<button class="btn btn-secondary">Try again</button>` calling `retry`.
      - ready: `<h1>Warehouse overview</h1>` and the intro line "Stock and movements across all bins, today." only. Stats, chart, tables and the Record movement drawer belong to a later story.
      The small component CSS the prototype defines inline (.skel-grid, .skel-card, .skel-tall, .skel-wide, .skel-short, .error-actions, `.alert > div`) is not in prototype-utils.css, so add it to apps/web/src/index.css on the same tokens (--space-1, --space-2, --space-3, --size-grid-min, --size-skeleton). Copy exact values from the prototype's inline style block, expressed as tokens; no colour or pixel literal. The grid uses auto-fit minmax(var(--size-grid-min), 1fr) so it falls back to one column at 375px.
      Tokens used through the existing classes: --color-fg, --color-fg-muted, --color-surface-sunken, --color-danger, --color-danger-bg, --color-primary, --color-border-strong, --space-1 to --space-6, --radius-sm/md/lg, --size-skeleton, --size-grid-min, --size-control-md, --font-size-lg, --font-weight-bold.
    files:
      - apps/web/src/dashboard/Dashboard.tsx
      - apps/web/src/dashboard/Dashboard.test.tsx
      - apps/web/src/index.css
    rationale: Covers AC 1 to 7. The component returns one branch, never the ready view plus an alert. One .btn-primary per screen holds in every state.
  - description: |
      Mount Dashboard in App in place of the placeholder heading, and update both existing tests that assert the "Web App" heading (App.test.tsx unit test and e2e/app.spec.ts). Replace the Tailwind slate placeholder wrapper with a single centered content column using design tokens (UI guidelines: one column, centered). `onAddFirstItem` is left unset in App: the destination belongs to the top bar and links story.
    files:
      - apps/web/src/App.tsx
      - apps/web/src/App.test.tsx
      - apps/web/e2e/app.spec.ts
    rationale: Makes the states reachable in the real app; the old heading assertions would fail once the placeholder is gone.
  - description: |
      Playwright journey against a stubbed `/api/dashboard` route (`page.route`): empty shows "Add first item"; fail-then-succeed shows the normal view after "Try again"; fail-twice shows the error again.
    files:
      - apps/web/e2e/dashboard-states.spec.ts
    rationale: Verifies the real browser flow including retry.
tests:
  - |
    AC1 (write first, Dashboard.test.tsx). A never-resolving loader shows only the loading state:
    ```tsx
    render(<Dashboard load={() => new Promise(() => {})} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading warehouse overview…')
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('heading', { name: 'Warehouse overview' })).not.toBeInTheDocument()
    ```
  - |
    AC2 and AC3 (Dashboard.test.tsx). Loader resolves `{ itemCount: 0 }`:
    ```tsx
    render(<Dashboard load={async () => ({ itemCount: 0 })} />)
    expect(await screen.findByRole('heading', { name: 'No stock recorded yet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add first item' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Warehouse overview' })).not.toBeInTheDocument()
    ```
    Also: clicking the button calls the `onAddFirstItem` spy once.
  - |
    AC4 and AC5 (Dashboard.test.tsx). Loader rejects:
    ```tsx
    render(<Dashboard load={async () => { throw new Error('boom') }} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The warehouse overview could not be loaded.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Warehouse overview' })).not.toBeInTheDocument()
    ```
  - |
    AC6 (Dashboard.test.tsx). First call rejects, second resolves:
    ```tsx
    const load = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ itemCount: 3 })
    render(<Dashboard load={load} />)
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Warehouse overview' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
    ```
  - |
    AC7 (Dashboard.test.tsx). Both calls reject; the error and button return:
    ```tsx
    const load = vi.fn().mockRejectedValue(new Error('x'))
    render(<Dashboard load={load} />)
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
    ```
  - |
    Hook (useDashboard.test.tsx). A stale response is ignored: with a loader whose first promise resolves late, call `retry()` and resolve the first one after the second; `result.current.state` must reflect only the second attempt. Unmount before resolve causes no state update.
  - |
    Client (api.test.ts). Rejects on malformed bodies and non-2xx, resolves on a valid body:
    ```ts
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    await expect(fetchDashboard()).rejects.toThrow()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    await expect(fetchDashboard()).rejects.toThrow()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"itemCount":2}', { status: 200 })))
    await expect(fetchDashboard()).resolves.toEqual({ itemCount: 2 })
    ```
  - |
    App.test.tsx: replace the "Web App" heading assertion. After stubbing `fetch` with a never-resolving promise:
    ```tsx
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<App />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    ```
  - |
    e2e (dashboard-states.spec.ts and the updated app.spec.ts). With `page.route('**/api/dashboard', ...)` fulfilling `{"itemCount":0}`:
    `await expect(page.getByRole('button', { name: 'Add first item' })).toBeVisible()`.
    With 500 then 200 `{"itemCount":3}`: click "Try again", then `await expect(page.getByRole('heading', { name: 'Warehouse overview' })).toBeVisible()`.
    With 500 twice: after the click `await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()`.
    Update app.spec.ts to stub the route and assert the same content instead of the "Web App" heading.
    Narrow commands: `cd apps/web && pnpm test -- src/dashboard src/App.test.tsx` and `cd apps/web && pnpm exec playwright test e2e/dashboard-states.spec.ts e2e/app.spec.ts`. The Python half of the configured command is unaffected because no API code changes.
assumptions_or_open_questions:
  - |
    BLOCKING for real end-to-end: the Core API has no dashboard endpoint (services/api/app holds only main.py, config.py, db.py and routers/health.py) and I found no stock, item or movement tables. This plan codes the Web App against an assumed contract `GET /api/dashboard` returning `{ "itemCount": number }` and does NOT create the endpoint, because inventing stock tables and a migration is far larger than this story and its ACs cover only the replacement states. Please confirm who builds the endpoint (an earlier or later story, or a split from this one), and its real path and shape. Until it exists a real deployment shows the error state.
  - |
    "Empty" is defined as `itemCount === 0`. If the real endpoint reports emptiness differently, change only the mapping in `useDashboard`.
  - |
    Deferred question on refresh: this story loads once on open and again only through "Try again"; no polling. Partial failure: with one request there is none, any failure shows the whole error state. If the real Dashboard later needs several requests, a later story must decide whether one failing section blanks the whole view.
  - |
    The "Add first item" destination belongs to the top bar and links story; the button is shown and callable, but nothing navigates until that story wires `onAddFirstItem`. The prototype only shows a toast there, which is not carried over.
  - |
    apps/web/design/tokens.css lines 70 to 72 set `--duration-fast`, `--duration-spin` and `--duration-pulse` to the literal text `[object Object]` (token-build defect, confirmed by grep). Those are invalid CSS, so the skeleton pulse and button transitions will not animate. I will not hand-edit the generated file or invent durations; please say whether tokens.json should be fixed in a separate chore.
  - |
    Copy is taken verbatim from the approved prototype and is warehouse specific ("No stock recorded yet", "Warehouse overview"); it satisfies the ACs' generic "no data", "loading" and "load failed".
  - |
    The prototype shows these states inside the app shell (top bar, footer). The shell is not built and belongs to the top bar story, so the states render in the current App root without it.
decisions:
  - decision: Load the Dashboard with a single request and treat any failure as one whole-Dashboard error.
    rationale: Answers the deferred question and matches the ACs, where the error state replaces all content, so a half-loaded view never needs designing.
    alternatives:
      - Several requests per section with per-section errors
      - Show stale data plus an error banner
    durable: false
    evidence: []
    scope: web
    status: proposed
  - decision: Keep Dashboard load state in a useDashboard hook with an injectable loader, using plain React state and no data-fetching library.
    rationale: Three states and a retry do not justify a new dependency; the injectable loader is the test seam.
    alternatives:
      - Add TanStack Query
    durable: false
    evidence: []
    scope: web
    status: proposed
  - decision: Style the states only with the design-system classes and tokens, imported once in apps/web/src/index.css.
    rationale: UI guidelines require tokens only; the classes used are all defined in prototype-utils.css.
    alternatives:
      - Re-style with Tailwind utilities and slate colours as in the placeholder App
    durable: true
    evidence:
      - apps/web/design/prototype-utils.css
      - apps/web/src/index.css
    scope: web
    status: proposed
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  None — Web App UI only. No migration, stored data, seed, env var or setting changes. The API contract `GET /api/dashboard` is an assumption (see open questions); the endpoint must exist before this ships, and rollback is reverting the Web App commit.

  Design loading: apps/web/src/index.css is only `@import "tailwindcss";` today and main.tsx imports it; vite.config.ts uses `@tailwindcss/vite`. Two `@import` lines are added after Tailwind so design classes come after preflight.

  Read from the prototype (TESTING-20-NOV-UX-DESIGN-004-design.html): states default, loading, empty, error; empty uses `.empty-state` with one `.btn-primary`; error uses `.alert.alert-danger` with `role="alert"` and a `.btn-secondary` "Try again"; loading uses `.skeleton` blocks with `role="status"`, `aria-busy="true"` and an `.sr-only` label. This matches UI-GUIDELINES.

  AC and prototype agree, with one difference: the prototype's retry jumps straight to the default view (`data-goto-state="default"`), while AC 7 needs a real re-request, so Try again shows loading and then the outcome.

  The existing e2e/app.spec.ts also asserts the "Web App" heading and is updated in this plan.

  ```mermaid
  flowchart TD
    main["main.tsx"] --> App["App.tsx (replace placeholder)"]
    main --> css["index.css (import design CSS, state styles)"]
    App --> Dashboard["dashboard/Dashboard.tsx (4 views)"]
    Dashboard --> hook["dashboard/useDashboard.ts (state, retry)"]
    hook --> api["dashboard/api.ts (one fetch)"]
    api --> core["Core API GET /api/dashboard (assumed, not built here)"]
    css --> tokens["design/tokens.css and prototype-utils.css"]
    classDef touched fill:#f96,color:#000
    class App,css,Dashboard,hook,api touched
  ```
review_focus: |
  IN: the four whole-Dashboard views (loading, empty, error, minimal ready), the single-request client, retry, and loading the design CSS once. OUT: the full Dashboard view, the Core API endpoint (assumed contract, open question), and top bar navigation for "Add first item". Riskiest part is retry and stale-response handling in `useDashboard` (StrictMode double mount, rapid double click on "Try again"). The `[object Object]` duration tokens and the unbuilt endpoint are deliberate open questions, not oversights.
