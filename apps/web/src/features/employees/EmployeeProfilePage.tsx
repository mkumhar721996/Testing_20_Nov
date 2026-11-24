import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { hasPersonal, markLeaver, type EmployeeView } from '../../api/employees'
import ConfirmModal from '../../components/ConfirmModal'
import Toast from '../../components/Toast'
import PersonalDetailsDrawer from './PersonalDetailsDrawer'
import WorkDetailsDrawer from './WorkDetailsDrawer'
import { useEmployee } from './useEmployee'
import './employees.css'

type Dialog = 'work' | 'personal' | 'leaver' | null

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')

function InfoIcon() {
  return (
    <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

function BackLink() {
  return (
    <Link className="backlink" to="/">
      <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
      </svg>
      Back to directory
    </Link>
  )
}

export default function EmployeeProfilePage() {
  const { employeeId = 'me' } = useParams()
  const navigate = useNavigate()
  const { state, reload, replace } = useEmployee(employeeId)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [leaverPending, setLeaverPending] = useState(false)
  const [leaverError, setLeaverError] = useState<string | null>(null)

  const loadedId = state.kind === 'ready' ? state.employee.id : null
  useEffect(() => {
    if (employeeId === 'me' && loadedId) navigate(`/employees/${loadedId}`, { replace: true })
  }, [employeeId, loadedId, navigate])

  if (state.kind === 'loading') {
    return (
      <div className="stack-lg" aria-busy="true">
        <BackLink />
        <div className="card skel-row">
          {[40, 70, 55, 65].map((width) => (
            <div key={width} className="skeleton skel-line" style={{ width: `${width}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (state.kind === 'not-available') {
    return (
      <div className="stack-lg">
        <BackLink />
        <div className="empty-state" role="status">
          <h3>This profile isn't available</h3>
          <p className="text-muted">
            The record you opened is not shown to you. If you think this is a mistake, ask someone in HR.
          </p>
          <Link className="btn btn-primary" to="/">
            Search the directory
          </Link>
        </div>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="stack-lg">
        <BackLink />
        <div className="alert alert-danger" role="alert">
          <div className="stack-sm">
            <strong>We couldn't load this profile.</strong>
            <span>The record didn't arrive. Nothing was changed. Try again in a moment.</span>
            <div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const employee: EmployeeView = state.employee
  const { viewer } = employee
  const inactive = employee.status === 'inactive'
  const firstName = employee.name.split(/\s+/)[0]
  const closeDialog = () => setDialog(null)
  const saved = (message: string) => (updated: EmployeeView) => {
    replace(updated)
    closeDialog()
    setToast(message)
  }

  async function confirmLeaver() {
    setLeaverPending(true)
    setLeaverError(null)
    try {
      replace(await markLeaver(employee.id))
      closeDialog()
      setToast(`${employee.name} is marked as a leaver.`)
    } catch (err) {
      setLeaverError(errorMessage(err, "We couldn't mark this employee as a leaver. Try again."))
    } finally {
      setLeaverPending(false)
    }
  }

  return (
    <div className="stack-lg">
      <BackLink />
      <div className="page-head">
        <div className="who">
          <span className="avatar" aria-hidden="true">
            {initials(employee.name)}
          </span>
          <div>
            <h1>{employee.name}</h1>
            <div className="cluster">
              <span className={`badge ${inactive ? 'badge-neutral' : 'badge-success'}`}>
                {inactive ? 'Inactive' : 'Active'}
              </span>
              <span className="text-muted">
                {employee.job_title}, {employee.department}
              </span>
            </div>
          </div>
        </div>
        {viewer.can_edit_work && (
          <div className="cluster">
            <button type="button" className="btn btn-primary" onClick={() => setDialog('work')}>
              Edit work details
            </button>
            {viewer.can_mark_leaver && (
              <button type="button" className="btn btn-secondary" onClick={() => setDialog('leaver')}>
                Mark as leaver
              </button>
            )}
            <Link className="btn btn-ghost" to="/employees/new">
              Add employee
            </Link>
          </div>
        )}
      </div>

      {inactive && (
        <div className="alert alert-warning">
          <InfoIcon />
          <span>
            <strong>Inactive leaver.</strong> Only HR admins can see this record. It is read-only.
          </span>
        </div>
      )}
      {viewer.can_edit_personal && (
        <div className="alert alert-info">
          <InfoIcon />
          <span>You can update your own contact details. HR manages your name, job title, department and manager.</span>
        </div>
      )}
      {!hasPersonal(employee) && (
        <div className="alert alert-info">
          <InfoIcon />
          <span>
            You can see work details for your team. Personal contact details are shown only to the employee and HR.
          </span>
        </div>
      )}

      <section className="card" aria-labelledby="work-details-title">
        <div className="card-head">
          <h2 className="card-title" id="work-details-title">
            Work details
          </h2>
          <span className="badge badge-neutral">{viewer.can_edit_work ? 'Edited by HR' : 'Managed by HR'}</span>
        </div>
        <dl className="kv">
          <dt>Name</dt>
          <dd>{employee.name}</dd>
          <dt>Job title</dt>
          <dd>{employee.job_title}</dd>
          <dt>Department</dt>
          <dd>{employee.department}</dd>
          <dt>Manager</dt>
          <dd>{employee.manager_name ?? 'No manager'}</dd>
          <dt>Work email</dt>
          <dd>{employee.work_email}</dd>
        </dl>
      </section>

      {hasPersonal(employee) ? (
        <section className="card" aria-labelledby="personal-details-title">
          <div className="card-head">
            <h2 className="card-title" id="personal-details-title">
              Personal contact details
            </h2>
            {viewer.can_edit_personal ? (
              <button type="button" className="btn btn-primary" onClick={() => setDialog('personal')}>
                Edit contact details
              </button>
            ) : (
              <span className="badge badge-neutral">Edited by the employee</span>
            )}
          </div>
          <dl className="kv">
            <dt>Personal phone</dt>
            <dd>{employee.personal.personal_phone ?? 'Not added yet'}</dd>
            <dt>Home address</dt>
            <dd className="preline">{employee.personal.home_address ?? 'Not added yet'}</dd>
            <dt>Emergency contact</dt>
            <dd>
              {employee.personal.emergency_contact_name ? (
                <>
                  <span>{employee.personal.emergency_contact_name}</span>
                  <br />
                  <span>{employee.personal.emergency_contact_phone}</span>
                </>
              ) : (
                'Not added yet'
              )}
            </dd>
          </dl>
        </section>
      ) : (
        <section className="card" aria-labelledby="personal-details-title">
          <h2 className="card-title" id="personal-details-title">
            Personal contact details
          </h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Not shown. Only {firstName} and HR admins can see these.
          </p>
        </section>
      )}

      {dialog === 'work' && <WorkDetailsDrawer employee={employee} onSaved={saved('Work details saved.')} onClose={closeDialog} />}
      {dialog === 'personal' && hasPersonal(employee) && (
        <PersonalDetailsDrawer
          employeeId={employee.id}
          current={employee.personal}
          onSaved={saved('Contact details saved.')}
          onClose={closeDialog}
        />
      )}
      {dialog === 'leaver' && (
        <ConfirmModal
          title={`Mark ${employee.name} as a leaver?`}
          confirmLabel="Mark as leaver"
          cancelLabel="Keep as active"
          pending={leaverPending}
          error={leaverError}
          onConfirm={confirmLeaver}
          onCancel={closeDialog}
        >
          Their record becomes inactive. Only HR admins can see it afterwards, and they can no longer change their
          contact details.
        </ConfirmModal>
      )}
      {toast && <Toast message={toast} onHide={() => setToast(null)} />}
    </div>
  )
}
