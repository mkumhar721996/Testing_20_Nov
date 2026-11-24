export default function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="alert alert-danger" role="alert">
      <svg
        className="icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
      <div>
        <strong>The warehouse overview could not be loaded.</strong>
        <span>Check your connection, then try again. Your stock data has not changed.</span>
        <div className="error-actions">
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
