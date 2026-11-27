import { useCallback, useEffect, useState } from 'react'
import { ApiError, getEmployee, getEmploymentHistory } from '../../api/client'
import type { HistoryEntry, Viewer } from '../../api/types'
import './employment.css'

type Props = { employeeId: string; onBack: () => void; onChange: () => void }
type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; entries: HistoryEntry[]; viewer: Viewer }

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

export function EmploymentHistory({ employeeId, onBack, onChange }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  const load = useCallback(() => {
    setState({ kind: 'loading' })
    Promise.all([getEmploymentHistory(employeeId), getEmployee(employeeId)]).then(
      ([entries, employee]) => setState({ kind: 'ready', entries, viewer: employee.viewer }),
      (err) =>
        setState({ kind: err instanceof ApiError && err.status === 403 ? 'unavailable' : 'error' }),
    )
  }, [employeeId])

  useEffect(load, [load])

  return (
    <div className="stack-lg">
      <button type="button" className="backlink" onClick={onBack}>
        <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        Back to profile
      </button>
      <h1 className="page-title">Employment history</h1>
      {state.kind === 'loading' && (
        <div className="card skel-card" role="status" aria-busy="true">
          <span className="sr-only">Loading employment history…</span>
          {[0, 1, 2].map((i) => (
            <span key={i} className="skeleton" />
          ))}
        </div>
      )}
      {state.kind === 'error' && (
        <div className="alert alert-danger" role="alert">
          <div>
            <strong>The employment history could not be loaded.</strong>
            <div className="error-actions">
              <button type="button" className="btn btn-secondary" onClick={load}>
                Try again
              </button>
            </div>
          </div>
        </div>
      )}
      {state.kind === 'unavailable' && (
        <div className="empty-state" role="status">
          <h3>Employment history isn't available to you</h3>
          <p className="text-muted">Only HR and the employee can see the history of changes.</p>
        </div>
      )}
      {state.kind === 'ready' && state.entries.length === 0 && (
        <div className="empty-state">
          <h3>No changes recorded yet</h3>
          <p className="text-muted">
            When a job, department or manager changes, each change appears here with its effective
            date.
          </p>
          {state.viewer === 'hr' && (
            <button type="button" className="btn btn-primary" onClick={onChange}>
              Change job, department or manager
            </button>
          )}
        </div>
      )}
      {state.kind === 'ready' && state.entries.length > 0 && (
        <section className="card" aria-label="Changes">
          <ol className="history-list">
            {state.entries.map((e) => (
              <li key={e.id}>
                <span className="when">
                  <time dateTime={e.effective_date}>{formatDate(e.effective_date)}</time>
                </span>
                <span>
                  <span className="badge badge-neutral">{e.field}</span>
                </span>
                <span className="what">
                  {e.to_name}
                  {e.from_name && <span className="from"> (was {e.from_name})</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
