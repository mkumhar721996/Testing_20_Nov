import { useCallback, useState } from 'react'
import type { RecentMovement } from '../../api/types'
import './dashboard.css'
import { MovementDrawer } from './MovementDrawer'
import { Toast } from './Toast'
import { useDashboard } from './useDashboard'

type Filter = 'all' | 'in' | 'out'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'Goods in' },
  { id: 'out', label: 'Goods out' },
]

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function Skeleton() {
  return (
    <div className="stack-lg" role="status" aria-busy="true">
      <span className="sr-only">Loading warehouse overview…</span>
      <div className="stack-sm">
        <span className="skeleton skel-short" />
        <span className="skeleton skel-wide" />
      </div>
      <div className="skel-grid">
        {[0, 1].map((i) => (
          <div key={i} className="card skel-card">
            <span className="skeleton" />
            <span className="skeleton skel-short" />
          </div>
        ))}
      </div>
      <div className="card skel-card">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="skeleton" />
        ))}
      </div>
    </div>
  )
}

function MovementsTable({ rows }: { rows: RecentMovement[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Item</th>
            <th scope="col">Bin</th>
            <th scope="col">Type</th>
            <th scope="col" className="num">
              Qty
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td>{formatTime(m.occurred_at)}</td>
              <td>{m.item_name}</td>
              <td>{m.bin}</td>
              <td>{m.direction === 'in' ? 'Goods in' : 'Goods out'}</td>
              <td className="num">{m.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DashboardPage() {
  const { data, status, retry, refetch } = useDashboard()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [toast, setToast] = useState<string>()
  const hideToast = useCallback(() => setToast(undefined), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const onSaved = useCallback(async () => {
    setToast('Movement saved. Figures updated.')
    if (!(await refetch())) {
      setToast('The figures could not be refreshed. Reload to see the latest.')
    }
  }, [refetch])

  if (status === 'error') {
    return (
      <div className="alert alert-danger" role="alert">
        <div>
          <strong>The warehouse overview could not be loaded.</strong>
          <span>Check your connection, then try again. Your stock data has not changed.</span>
          <div className="error-actions">
            <button type="button" className="btn btn-secondary" onClick={retry}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
  if (!data) return <Skeleton />

  if (data.item_count === 0) {
    return (
      <div className="empty-state">
        <h3>No stock recorded yet</h3>
        <p>
          No stock has been recorded in this warehouse yet. Add your first item to start tracking
          stock and movements.
        </p>
        <button type="button" className="btn btn-primary">
          Add first item
        </button>
      </div>
    )
  }

  const rows = data.recent_movements.filter((m) => filter === 'all' || m.direction === filter)

  return (
    <>
      <div className="stack-lg">
        <div className="page-head">
          <div>
            <h1>Warehouse overview</h1>
            <p className="text-muted">Stock and movements across all bins, today.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            aria-haspopup="dialog"
            onClick={() => setDrawerOpen(true)}
          >
            <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Record movement
          </button>
        </div>

        <div className="grid" aria-live="polite">
          <div className="card">
            <div className="stat">{data.items_in_stock.toLocaleString()}</div>
            <p className="text-muted">Items in stock</p>
          </div>
          <div className="card">
            <div className="stat">{data.movements_today.toLocaleString()}</div>
            <p className="text-muted">Movements today</p>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Recent movements</h3>
            <div className="tabs" role="group" aria-label="Filter movements">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="tab"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <MovementsTable rows={rows} />
        </div>
      </div>

      {drawerOpen && <MovementDrawer onClose={closeDrawer} onSaved={onSaved} />}
      {toast && <Toast message={toast} onHide={hideToast} />}
    </>
  )
}
