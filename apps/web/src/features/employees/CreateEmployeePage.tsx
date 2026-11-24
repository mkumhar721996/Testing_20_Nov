import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, errorMessage } from '../../api/client'
import { createEmployee, getEmployeeOptions, type EmployeeOptions } from '../../api/employees'
import Field from './Field'
import { validateCreate, type CreateField, type Errors } from './validation'
import './employees.css'

type Result =
  | { kind: 'created'; id: string; name: string }
  | { kind: 'duplicate'; existingId: string; name: string }
  | { kind: 'failed'; message: string }

const EMPTY: Record<CreateField, string> = { account_id: '', name: '', job_title: '', department: '', manager_id: '' }

export default function CreateEmployeePage() {
  const navigate = useNavigate()
  const [options, setOptions] = useState<EmployeeOptions | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState<Errors<CreateField>>({})
  const [result, setResult] = useState<Result | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getEmployeeOptions()
      .then(setOptions)
      .catch(() => setUnavailable(true))
  }, [])

  if (unavailable) {
    return (
      <div className="empty-state narrow" role="status">
        <h3>This page isn't available</h3>
        <p className="text-muted">Only HR admins can create employee profiles. If you think this is a mistake, ask someone in HR.</p>
        <Link className="btn btn-primary" to="/">
          Search the directory
        </Link>
      </div>
    )
  }

  const set = (field: CreateField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (field === 'account_id') {
      setResult(null)
      const account = options?.accounts.find((a) => a.id === value)
      if (account) setValues((current) => ({ ...current, account_id: value, name: account.name }))
    }
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
      const created = await createEmployee({
        ...values,
        name,
        job_title: values.job_title.trim(),
        department: values.department.trim(),
      })
      setResult({ kind: 'created', id: created.id, name })
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { existing_employee_id?: string } | null) : null
      if (err instanceof ApiError && err.status === 409 && body?.existing_employee_id) {
        setResult({ kind: 'duplicate', existingId: body.existing_employee_id, name })
      } else {
        setResult({ kind: 'failed', message: errorMessage(err, "We couldn't create the profile. Try again.") })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack-lg narrow">
      <button type="button" className="backlink" onClick={() => navigate(-1)}>
        <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        Back to profile
      </button>
      <h1 className="page-title">Create employee profile</h1>

      {!result && (
        <div className="alert alert-info">
          <span>
            Each employee has one profile. After you save, the employee can add their own phone, address and emergency
            contact.
          </span>
        </div>
      )}
      <div aria-live="polite">
        {result?.kind === 'duplicate' && (
          <div className="alert alert-danger" role="alert">
            <div className="stack-sm">
              <strong>{result.name} already has a profile.</strong>
              <span>No second profile was created. Open the existing profile to change it, or choose a different employee.</span>
              <div>
                <Link className="btn btn-secondary btn-sm" to={`/employees/${result.existingId}`}>
                  Open existing profile
                </Link>
              </div>
            </div>
          </div>
        )}
        {result?.kind === 'created' && (
          <div className="alert alert-success" role="status">
            <div className="stack-sm">
              <strong>Profile created for {result.name}.</strong>
              <span>They can now sign in and add their contact details.</span>
              <div>
                <Link className="btn btn-secondary btn-sm" to={`/employees/${result.id}`}>
                  Open profile
                </Link>
              </div>
            </div>
          </div>
        )}
        {result?.kind === 'failed' && (
          <div className="alert alert-danger" role="alert">
            <span>{result.message}</span>
          </div>
        )}
      </div>

      <form className="card stack" noValidate onSubmit={submit}>
        <Field
          id="c-account"
          label="Employee"
          hint="Choose a sign-in account. Employees who already have a profile are marked."
          error={errors.account_id}
        >
          {(aria) => (
            <select {...aria} value={values.account_id} onChange={(e) => set('account_id', e.target.value)}>
              <option value="">Choose an employee</option>
              {(options?.accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.has_profile ? `${a.name} (profile exists)` : `${a.name} (${a.email})`}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="c-name" label="Full name" error={errors.name}>
          {(aria) => <input {...aria} autoComplete="off" value={values.name} onChange={(e) => set('name', e.target.value)} />}
        </Field>
        <Field id="c-job" label="Job title" error={errors.job_title}>
          {(aria) => (
            <input {...aria} autoComplete="off" value={values.job_title} onChange={(e) => set('job_title', e.target.value)} />
          )}
        </Field>
        <div className="grid">
          <Field id="c-dept" label="Department" error={errors.department}>
            {(aria) => (
              <>
                <input {...aria} list="c-dept-list" value={values.department} onChange={(e) => set('department', e.target.value)} />
                <datalist id="c-dept-list">
                  {(options?.departments ?? []).map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field id="c-mgr" label="Manager" error={errors.manager_id}>
            {(aria) => (
              <select {...aria} value={values.manager_id} onChange={(e) => set('manager_id', e.target.value)}>
                <option value="">Choose a manager</option>
                {(options?.managers ?? []).map((m) => (
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
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
