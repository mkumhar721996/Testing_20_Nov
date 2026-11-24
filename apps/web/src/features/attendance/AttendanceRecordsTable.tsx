import type { AttendanceRecord } from './api'
import { formatDate, formatHours, formatTime } from './format'

// Rows render in the order given; the API returns newest first.
export default function AttendanceRecordsTable({ records }: { records: AttendanceRecord[] }) {
  return (
    <div className="card table-wrap">
      <table className="records">
        <thead>
          <tr>
            <th>Date</th>
            <th className="num">Clock in</th>
            <th className="num">Clock out</th>
            <th className="num">Hours</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>{formatDate(r.clockInAt)}</td>
              <td className="num">{formatTime(r.clockInAt)}</td>
              <td className="num">
                {r.clockOutAt ? formatTime(r.clockOutAt) : <span className="badge badge-success">In progress</span>}
              </td>
              <td className="num">{r.clockOutAt ? formatHours(r.clockInAt, r.clockOutAt) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
