export default function DashboardEmpty({ onAddFirstItem }: { onAddFirstItem: () => void }) {
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
}
