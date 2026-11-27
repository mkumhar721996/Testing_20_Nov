import { fetchDashboard } from './api'
import { useDashboard } from './useDashboard'

type Props = { load?: typeof fetchDashboard; onAddFirstItem?: () => void }

function Loading() {
  return (
    <div className="stack stack-lg" role="status" aria-busy="true">
      <span className="sr-only">Loading warehouse overview…</span>
      <div className="stack stack-sm">
        <span className="skeleton skel-short"></span>
        <span className="skeleton skel-wide"></span>
      </div>
      <div className="skel-grid">
        {[0, 1, 2, 3].map((tile) => (
          <div className="card skel-card" key={tile}>
            <span className="skeleton"></span>
            <span className="skeleton skel-short"></span>
          </div>
        ))}
      </div>
      <div className="card">
        <span className="skeleton skel-tall"></span>
      </div>
      <div className="card skel-card">
        {[0, 1, 2, 3].map((line) => (
          <span className="skeleton" key={line}></span>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard({ load, onAddFirstItem }: Props) {
  const { state, retry } = useDashboard(load)

  switch (state.status) {
    case 'loading':
      return <Loading />
    case 'empty':
      return (
        <div className="empty-state">
          <h3>No stock recorded yet</h3>
          <p>
            No stock has been recorded in this warehouse yet. Add your first item to start tracking
            stock and movements.
          </p>
          <button type="button" className="btn btn-primary" onClick={onAddFirstItem}>
            Add first item
          </button>
        </div>
      )
    case 'error':
      return (
        <div className="alert alert-danger" role="alert">
          <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
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
    case 'ready':
      return (
        <div className="stack stack-lg">
          <h1>Warehouse overview</h1>
          <p className="text-muted">Stock and movements across all bins, today.</p>
        </div>
      )
  }
}
