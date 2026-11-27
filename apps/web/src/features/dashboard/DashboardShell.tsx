const PRODUCT_NAV = [
  { id: 'fd', label: 'FD' },
  { id: 'pf', label: 'PF' },
  { id: 'nps', label: 'NPS' },
]

const QUICK_ACTIONS = [
  { id: 'transfer', label: 'Transfer money' },
  { id: 'pay-bill', label: 'Pay a bill' },
  { id: 'deposit', label: 'Deposit a cheque' },
]

// Destinations are not built yet: native `disabled` buttons with no handler can neither
// navigate nor change data.
export function DashboardTopRow() {
  return (
    <div className="top-row">
      <span className="logo">Banking</span>
      <span className="avatar" role="img" aria-label="Signed in as Alex K">
        AK
      </span>
    </div>
  )
}

export function ProductNav() {
  return (
    <nav className="dash-side" aria-label="Banking products">
      <ul className="side-list">
        {PRODUCT_NAV.map((n) => (
          <li key={n.id}>
            <button type="button" className="side-item" disabled>
              {n.label} <span className="badge">coming soon</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function QuickActions() {
  return (
    <div className="actions" role="group" aria-label="Quick actions">
      {QUICK_ACTIONS.map((a) => (
        <button key={a.id} type="button" className="btn btn-secondary" disabled>
          {a.label} · coming soon
        </button>
      ))}
    </div>
  )
}
