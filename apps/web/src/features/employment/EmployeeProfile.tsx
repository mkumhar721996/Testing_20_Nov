import { useCallback, useEffect, useState } from 'react'
import { getEmployee } from '../../api/client'
import type { Employee } from '../../api/types'
import { Toast } from '../dashboard/Toast'
import './employment.css'
import { StructureDrawer } from './StructureDrawer'

type Props = { employeeId: string; onViewHistory: () => void; openDrawer?: boolean }

export function EmployeeProfile({ employeeId, onViewHistory, openDrawer = false }: Props) {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [failed, setFailed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(openDrawer)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(() => {
    setFailed(false)
    getEmployee(employeeId).then(setEmployee, () => setFailed(true))
  }, [employeeId])

  useEffect(load, [load])

  const hideToast = useCallback(() => setToast(null), [])

  if (failed) {
    return (
      <div className="alert alert-danger" role="alert">
        <div>
          <strong>The employee could not be loaded.</strong>
          <div className="error-actions">
            <button type="button" className="btn btn-secondary" onClick={load}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
  if (!employee) {
    return (
      <div className="stack-lg" role="status" aria-busy="true">
        <span className="sr-only">Loading employee…</span>
        <span className="skeleton skel-wide" />
        <div className="card skel-card">
          <span className="skeleton" />
          <span className="skeleton skel-short" />
        </div>
      </div>
    )
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div className="who">
          <h1>{employee.name}</h1>
        </div>
        <div className="drawer-actions">
          {employee.viewer === 'hr' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={onViewHistory}>
                View history
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setDrawerOpen(true)}>
                Change job, department or manager
              </button>
            </>
          )}
          {employee.viewer === 'self' && (
            <button type="button" className="btn btn-secondary" onClick={onViewHistory}>
              View my history
            </button>
          )}
        </div>
      </div>
      {employee.viewer === 'self' && (
        <div className="alert alert-info" role="status">
          <div>HR keeps your job, department and manager up to date.</div>
        </div>
      )}
      {employee.viewer === 'manager' && (
        <div className="alert alert-info" role="status">
          <div>You can see current work details. Employment history isn't available to you.</div>
        </div>
      )}
      <section className="card" aria-labelledby="work-details">
        <div className="card-head">
          <h2 className="card-title" id="work-details">
            Work details
          </h2>
        </div>
        <dl className="kv">
          <dt>Current job</dt>
          <dd>{employee.job?.name ?? 'Not assigned'}</dd>
          <dt>Department</dt>
          <dd>{employee.department.name}</dd>
          <dt>Manager</dt>
          <dd>{employee.manager.name}</dd>
        </dl>
      </section>
      {drawerOpen && (
        <StructureDrawer
          employee={employee}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => {
            setToast('Job, department or manager saved.')
            load()
          }}
        />
      )}
      {toast && <Toast message={toast} onHide={hideToast} />}
    </div>
  )
}
