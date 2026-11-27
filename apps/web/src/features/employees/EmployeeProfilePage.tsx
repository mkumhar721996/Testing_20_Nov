import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { hasPersonal, markLeaver, type EmployeeView } from '../../api/employees'
import ConfirmModal from '../../components/ConfirmModal'
import Icon from '../../components/Icon'
import Toast from '../../components/Toast'
import { ITEMS_ROOT } from '../../shell/AppShell'
import PersonalDetailsDrawer from './PersonalDetailsDrawer'
import WorkDetailsDrawer from './WorkDetailsDrawer'
import { useEmployee } from './useEmployee'
import { saveError } from './validation'
import './employees.css'

type Overlay = 'work' | 'personal' | 'leaver' | null

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')

export default function EmployeeProfilePage() {
  const { employeeId = 'me' } = useParams()
  const navigate = useNavigate()
  const { state, reload, setEmployee } = useEmployee(employeeId)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [leaverFailure, setLeaverFailure] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)

  const loadedId = state.status === 'ready' ? state.employee.id : null
  useEffect(() => {
    if (employeeId === 'me' && loadedId) navigate(`/employees/${loadedId}`, { replace: true })
  }, [employeeId, loadedId, navigate])

  if (state.status === 'loading') {
    return (
      <div className="stack-lg" aria-busy="true">
        <div className="card skel-row">
          {[40, 70, 55, 65].map((width) => (
            <div key={width} className="skeleton skel-line" style={{ width: `${width}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <div className="stack-lg">
        <div className="empty-state" role="status">
          <h3>This profile isn't available</h3>
          <p className="text-muted">
            The record you opened is not shown to you. If you think this is a mistake, ask someone in HR.
          </p>
          <Link to={ITEMS_ROOT} className="btn btn-primary">
            Search the directory
          </Link>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="alert alert-danger" role="alert">
        <Icon name="alert" />
        <div className="stack-sm">
          <strong>We couldn't load this profile.</strong>
          <span>The connection dropped before the record arrived. Nothing was changed. Try again in a moment.</span>
          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const employee = state.employee
  const { viewer } = employee
  const isActive = employee.status === 'active'
  const firstName = employee.name.split(/\s+/)[0]

  const saved = (updated: EmployeeView, message: string) => {
    setEmployee(updated)
    setOverlay(null)
    setToast(message)
  }

  async function confirmLeaver() {
    setMarking(true)
    setLeaverFailure(null)
    try {
      saved(await markLeaver(employee.id), `${employee.name} is marked as a leaver.`)
    } catch (error) {
      setLeaverFailure(saveError(error))
    }
    setMarking(false)
  }

  const note = !isActive ? (
    <div className="alert alert-warning">
      <Icon name="info" />
      <span>
        <strong>Inactive leaver.</strong> Only HR admins can see this record. It is read-only.
      </span>
    </div>
  ) : viewer.can_edit_personal ? (
    <div className="alert alert-info">
      <Icon name="info" />
      <span>You can update your own contact details. HR manages your name, job title, department and manager.</span>
    </div>
  ) : !viewer.can_edit_work && !hasPersonal(employee) ? (
    <div className="alert alert-info">
      <Icon name="info" />
      <span>
        You can see work details for your team. Personal contact details are shown only to the employee and HR.
      </span>
    </div>
  ) : null

  return (
    <div className="stack-lg">
      <Link to={ITEMS_ROOT} className="backlink">
        <Icon name="arrow-left" />
        Back to directory
      </Link>
      <div className="page-head">
        <div className="who">
          <span className="avatar" aria-hidden="true">
            {initials(employee.name)}
          </span>
          <div>
            <h1>{employee.name}</h1>
            <div className="cluster">
              <span className={`badge ${isActive ? 'badge-success' : 'badge-neutral'}`}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
              <span className="text-muted">
                {employee.job_title}, {employee.department}
              </span>
            </div>
          </div>
        </div>
        {viewer.can_edit_work && (
          <div className="cluster">
            <button type="button" className="btn btn-primary" onClick={() => setOverlay('work')}>
              Edit work details
            </button>
            {viewer.can_mark_leaver && (
              <button type="button" className="btn btn-secondary" onClick={() => setOverlay('leaver')}>
                Mark as leaver
              </button>
            )}
            <Link to="/employees/new" className="btn btn-ghost">
              Add employee
            </Link>
          </div>
        )}
      </div>
      {note}
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
          <dd>{employee.manager_name ?? 'None'}</dd>
          <dt>Work email</dt>
          <dd>{employee.work_email}</dd>
        </dl>
      </section>
      <section className="card" aria-labelledby="personal-details-title">
        {hasPersonal(employee) ? (
          <>
            <div className="card-head">
              <h2 className="card-title" id="personal-details-title">
                Personal contact details
              </h2>
              {viewer.can_edit_personal ? (
                <button type="button" className="btn btn-primary" onClick={() => setOverlay('personal')}>
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
              <dd>{employee.personal.home_address ?? 'Not added yet'}</dd>
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
          </>
        ) : (
          <>
            <h2 className="card-title" id="personal-details-title">
              Personal contact details
            </h2>
            <p className="text-muted">Not shown. Only {firstName} and HR admins can see these.</p>
          </>
        )}
      </section>

      {overlay === 'work' && (
        <WorkDetailsDrawer
          employee={employee}
          onSaved={(updated) => saved(updated, 'Work details saved.')}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay === 'personal' && hasPersonal(employee) && (
        <PersonalDetailsDrawer
          employeeId={employee.id}
          current={employee.personal}
          onSaved={(updated) => saved(updated, 'Contact details saved.')}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay === 'leaver' && (
        <ConfirmModal
          title={`Mark ${employee.name} as a leaver?`}
          onClose={() => setOverlay(null)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setOverlay(null)}>
                Keep as active
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmLeaver} disabled={marking}>
                {marking ? 'Saving…' : 'Mark as leaver'}
              </button>
            </>
          }
        >
          <p>
            Their record becomes inactive. Only HR admins can see it afterwards, and they can no longer change
            their contact details.
          </p>
          {leaverFailure && (
            <div className="alert alert-danger" role="alert">
              <Icon name="alert" />
              <span>{leaverFailure}</span>
            </div>
          )}
        </ConfirmModal>
      )}
      {toast && <Toast message={toast} onHide={() => setToast(null)} />}
    </div>
  )
}
