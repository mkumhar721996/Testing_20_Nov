import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { createEmployee, getEmployeeOptions, type EmployeeOptions } from '../../api/employees'
import Icon from '../../components/Icon'
import { ITEMS_ROOT } from '../../shell/AppShell'
import Field from './Field'
import { saveError, validateCreate, type CreateValues, type Errors } from './validation'
import './employees.css'

type Load = { status: 'loading' } | { status: 'unavailable' } | { status: 'error' } | { status: 'ready'; options: EmployeeOptions }

type Result =
  | { kind: 'created'; id: string; name: string }
  | { kind: 'duplicate'; id: string; name: string }
  | { kind: 'failed'; message: string }

const EMPTY: CreateValues = { account_id: '', name: '', job_title: '', department: '', manager_id: '' }

export default function CreateEmployeePage() {
  const departmentsId = useId()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [values, setValues] = useState<CreateValues>(EMPTY)
  const [errors, setErrors] = useState<Errors<keyof CreateValues>>({})
  const [result, setResult] = useState<Result | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getEmployeeOptions().then(
      (options) => setLoad({ status: 'ready', options }),
      (error: unknown) => {
        const denied = error instanceof ApiError && (error.status === 403 || error.status === 404)
        setLoad({ status: denied ? 'unavailable' : 'error' })
      },
    )
  }, [])

  if (load.status === 'loading') {
    return (
      <div className="stack-lg narrow" aria-busy="true">
        <div className="card skel-row">
          {[40, 70, 55].map((width) => (
            <div key={width} className="skeleton skel-line" style={{ width: `${width}%` }} />
          ))}
        </div>
      </div>
    )
  }
  if (load.status === 'unavailable') {
    return (
      <div className="empty-state narrow" role="status">
        <h3>This page isn't available</h3>
        <p className="text-muted">Only HR admins can create employee profiles. Ask someone in HR if you need one.</p>
        <Link to={ITEMS_ROOT} className="btn btn-primary">
          Search the directory
        </Link>
      </div>
    )
  }
  if (load.status === 'error') {
    return (
      <div className="alert alert-danger narrow" role="alert">
        <Icon name="alert" />
        <span>We couldn't load this page. Nothing was changed. Reload the page to try again.</span>
      </div>
    )
  }

  const { options } = load
  const set = (key: keyof CreateValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }))

  function chooseAccount(accountId: string) {
    const account = options.accounts.find((a) => a.id === accountId)
    setValues((v) => ({ ...v, account_id: accountId, name: account ? account.name : v.name }))
    setResult(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setResult(null)
    const found = validateCreate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const name = values.name.trim()
    setSaving(true)
    try {
      const created = await createEmployee({ ...values, name })
      setResult({ kind: 'created', id: created.id, name })
      setLoad({
        status: 'ready',
        options: {
          ...options,
          accounts: options.accounts.map((a) => (a.id === values.account_id ? { ...a, has_profile: true } : a)),
        },
      })
    } catch (error) {
      const existing =
        error instanceof ApiError && error.status === 409 && error.body && typeof error.body === 'object'
          ? (error.body as { existing_employee_id?: string }).existing_employee_id
          : undefined
      setResult(
        existing
          ? { kind: 'duplicate', id: existing, name }
          : { kind: 'failed', message: saveError(error) },
      )
    }
    setSaving(false)
  }

  return (
    <div className="stack-lg narrow">
      <Link to={ITEMS_ROOT} className="backlink">
        <Icon name="arrow-left" />
        Back to profile
      </Link>
      <h1>Create employee profile</h1>
      {result === null && (
        <div className="alert alert-info">
          <Icon name="info" />
          <span>
            Each employee has one profile. After you save, the employee can add their own phone, address and
            emergency contact.
          </span>
        </div>
      )}
      {result?.kind === 'duplicate' && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" />
          <div className="stack-sm">
            <strong>{result.name} already has a profile.</strong>
            <span>
              No second profile was created. Open the existing profile to change it, or choose a different
              employee.
            </span>
            <div>
              <Link to={`/employees/${result.id}`} className="btn btn-secondary btn-sm">
                Open existing profile
              </Link>
            </div>
          </div>
        </div>
      )}
      {result?.kind === 'created' && (
        <div className="alert alert-success" role="status">
          <Icon name="check" />
          <div className="stack-sm">
            <strong>Profile created for {result.name}.</strong>
            <span>They can now sign in and add their contact details.</span>
            <div>
              <Link to={`/employees/${result.id}`} className="btn btn-secondary btn-sm">
                Open profile
              </Link>
            </div>
          </div>
        </div>
      )}
      {result?.kind === 'failed' && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" />
          <span>{result.message}</span>
        </div>
      )}
      <form className="card stack" onSubmit={submit} noValidate>
        <Field label="Employee" error={errors.account_id} hint="Choose a sign-in account. Employees who already have a profile are marked.">
          {(p) => (
            <select {...p} value={values.account_id} onChange={(e) => chooseAccount(e.target.value)}>
              <option value="">Choose an employee</option>
              {options.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.has_profile ? `${a.name} (profile exists)` : `${a.name} (${a.email})`}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Full name" error={errors.name}>
          {(p) => <input {...p} autoComplete="off" value={values.name} onChange={(e) => set('name')(e.target.value)} />}
        </Field>
        <Field label="Job title" error={errors.job_title}>
          {(p) => <input {...p} autoComplete="off" value={values.job_title} onChange={(e) => set('job_title')(e.target.value)} />}
        </Field>
        <div className="grid">
          <Field label="Department" error={errors.department}>
            {(p) => (
              <>
                <input {...p} list={departmentsId} autoComplete="off" value={values.department} onChange={(e) => set('department')(e.target.value)} />
                <datalist id={departmentsId}>
                  {options.departments.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Manager" error={errors.manager_id}>
            {(p) => (
              <select {...p} value={values.manager_id} onChange={(e) => set('manager_id')(e.target.value)}>
                <option value="">Choose a manager</option>
                {options.managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="cluster">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create profile'}
          </button>
          <Link to={ITEMS_ROOT} className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
