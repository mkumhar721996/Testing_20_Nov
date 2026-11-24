import './attendance.css'
import type { RefusalCode } from './api'
import AttendanceRecordsTable from './AttendanceRecordsTable'
import { formatTime } from './format'
import StatusCard from './StatusCard'
import { useAttendance } from './useAttendance'

function Refusal({ code, clockInAt }: { code: RefusalCode; clockInAt: string | undefined }) {
  return (
    <div className="alert alert-danger" role="alert">
      {code === 'already_clocked_in' && (
        <>
          <strong>You are already clocked in.</strong> Clock out first if you want to end this shift.
          {clockInAt && ` Your clock in time of ${formatTime(clockInAt)} is unchanged.`}
        </>
      )}
      {code === 'not_clocked_in' && (
        <>
          <strong>You are not clocked in.</strong> Clock in first to start a shift. No record was added.
        </>
      )}
      {code === 'other_employee' && (
        <>
          <strong>Request refused.</strong> It named another employee. You can only clock yourself in or out.
          Nothing was recorded for anyone.
        </>
      )}
    </div>
  )
}

export default function AttendancePage() {
  const a = useAttendance()

  return (
    <main className="container page stack-lg">
      <div className="head">
        <h1>My attendance</h1>
        <span className="text-muted text-sm">Your records only</span>
      </div>

      {a.status === 'loading' && (
        <section className="stack-lg" aria-busy="true">
          <div className="card stack">
            <div className="skeleton skel-row" />
            <div className="skeleton skel-row" />
          </div>
          <div className="card">
            <span className="sr-only" role="status">
              Loading your attendance records
            </span>
            <div className="skeleton skel-row" />
            <div className="skeleton skel-row" />
            <div className="skeleton skel-row" />
            <div className="skeleton skel-row" />
          </div>
        </section>
      )}

      {a.status === 'error' && (
        <div className="alert alert-danger" role="alert">
          <strong>Your records did not load.</strong> Check your connection and try again. Clocking in and out
          may be unavailable until they load.
          <div className="mt-3">
            <button type="button" className="btn btn-secondary" onClick={() => void a.reload()}>
              Try again
            </button>
          </div>
        </div>
      )}

      {a.status === 'ready' && (
        <section className="stack-lg">
          {a.refusal && (
            <Refusal
              code={a.refusal}
              clockInAt={a.clockedIn ? a.records[0]?.clockInAt : undefined}
            />
          )}
          <StatusCard
            records={a.records}
            clockedIn={a.clockedIn}
            pending={a.pending}
            showActions={a.records.length > 0}
            onClockIn={() => void a.clockIn()}
            onClockOut={() => void a.clockOut()}
          />
          {a.records.length === 0 ? (
            <div className="empty-state">
              <h2>No attendance records yet</h2>
              <p className="text-muted">
                Each time you clock in and out, the date and times appear here. Only you can see them on this
                page.
              </p>
              <button type="button" className="btn btn-primary" disabled={a.pending} onClick={() => void a.clockIn()}>
                Clock in
              </button>
            </div>
          ) : (
            <div className="stack">
              <h2>Your records</h2>
              <AttendanceRecordsTable records={a.records} />
            </div>
          )}
        </section>
      )}

      {a.notice && (
        <div className="toast" role="status">
          {a.notice.action === 'clock-in'
            ? `Clocked in at ${formatTime(a.notice.at)}.`
            : `Clocked out at ${formatTime(a.notice.at)}. Record saved.`}
        </div>
      )}
    </main>
  )
}
