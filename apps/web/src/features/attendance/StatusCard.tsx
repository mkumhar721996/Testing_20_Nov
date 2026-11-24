import type { AttendanceRecord } from './api'
import { formatDate, formatTime, isToday } from './format'

type Props = {
  records: AttendanceRecord[]
  clockedIn: boolean
  pending: boolean
  // The empty state carries its own single primary Clock in button.
  showActions: boolean
  onClockIn: () => void
  onClockOut: () => void
}

export default function StatusCard({ records, clockedIn, pending, showActions, onClockIn, onClockOut }: Props) {
  const latest = records[0]
  const lastClosed = records.find((r) => r.clockOutAt !== null)

  let timeText = 'Not clocked in'
  let detail: string | null = null
  if (clockedIn && latest) {
    const at = formatTime(latest.clockInAt)
    timeText = isToday(latest.clockInAt) ? `Since ${at} today` : `Since ${at} on ${formatDate(latest.clockInAt)}`
    detail = formatDate(latest.clockInAt)
  } else if (lastClosed?.clockOutAt) {
    detail = `Last clock out: ${formatDate(lastClosed.clockOutAt)} at ${formatTime(lastClosed.clockOutAt)}`
  }

  return (
    <div className="card stack">
      <div className="status-row">
        <div className="stack-sm">
          <span className={clockedIn ? 'badge badge-success' : 'badge badge-neutral'}>
            {clockedIn ? 'Clocked in' : 'Clocked out'}
          </span>
          <p className="status-time">{timeText}</p>
          {detail && <p className="text-muted text-sm">{detail}</p>}
        </div>
        {showActions && (
          <div className="actions">
            <button
              type="button"
              className={clockedIn ? 'btn btn-secondary' : 'btn btn-primary'}
              disabled={pending}
              onClick={onClockIn}
            >
              Clock in
            </button>
            <button
              type="button"
              className={clockedIn ? 'btn btn-primary' : 'btn btn-secondary'}
              disabled={pending}
              onClick={onClockOut}
            >
              Clock out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
