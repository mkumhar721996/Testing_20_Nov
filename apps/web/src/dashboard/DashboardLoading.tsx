export default function DashboardLoading() {
  return (
    <div className="stack-lg" role="status" aria-busy="true">
      <span className="sr-only">Loading warehouse overview…</span>
      <div className="stack-sm">
        <span className="skeleton skel-short"></span>
        <span className="skeleton skel-wide"></span>
      </div>
      <div className="skel-grid">
        {[0, 1, 2, 3].map((n) => (
          <div className="card skel-card" key={n}>
            <span className="skeleton"></span>
            <span className="skeleton skel-short"></span>
          </div>
        ))}
      </div>
      <div className="card">
        <span className="skeleton skel-tall"></span>
      </div>
      <div className="card skel-card">
        <span className="skeleton"></span>
        <span className="skeleton"></span>
        <span className="skeleton"></span>
        <span className="skeleton"></span>
      </div>
    </div>
  )
}
