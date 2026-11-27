import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { ApiError, getDepartments, getJobs, getManagers, saveStructure } from '../../api/client'
import type { Employee, NamedRef } from '../../api/types'
import './employment.css'

type Props = { employee: Employee; onClose: () => void; onSaved: () => void }
type FieldKey = 'job_id' | 'department_id' | 'manager_id'
type Errors = Partial<Record<FieldKey | 'effective_date' | 'form', string>>

const FOCUSABLE = 'button:not(:disabled), select:not(:disabled), input:not(:disabled)'

const FIELDS: { key: FieldKey; label: string; placeholder: string; id: string }[] = [
  { key: 'job_id', label: 'Job', placeholder: 'Choose a job', id: 'sd-job' },
  { key: 'department_id', label: 'Department', placeholder: 'Choose a department', id: 'sd-department' },
  { key: 'manager_id', label: 'Manager', placeholder: 'Choose a manager', id: 'sd-manager' },
]

const REQUIRED: Record<FieldKey, string> = {
  job_id: 'Choose a job.',
  department_id: "Choose a department. The record can't be saved without one.",
  manager_id: "Choose a manager. The record can't be saved without one.",
}
const NOTHING_CHANGED = 'Nothing has changed. Pick a different job, department or manager, then save.'
const DATE_REQUIRED = 'Enter the date the change takes effect.'

export function StructureDrawer({ employee, onClose, onSaved }: Props) {
  const original: Record<FieldKey, string> = {
    job_id: employee.job?.id ?? '',
    department_id: employee.department.id,
    manager_id: employee.manager.id,
  }
  const [values, setValues] = useState(original)
  const [effectiveDate, setEffectiveDate] = useState('')
  const [choices, setChoices] = useState<Record<FieldKey, NamedRef[]>>({
    job_id: [],
    department_id: [],
    manager_id: [],
  })
  const [loadFailed, setLoadFailed] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    drawerRef.current?.querySelector<HTMLElement>('select')?.focus()
    Promise.all([getJobs(), getDepartments(), getManagers()]).then(
      ([job_id, department_id, manager_id]) => setChoices({ job_id, department_id, manager_id }),
      () => setLoadFailed(true),
    )
    return () => opener?.focus()
  }, [])

  function dismiss() {
    if (!saving) onClose()
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape') {
      dismiss()
      return
    }
    if (e.key !== 'Tab' || !drawerRef.current) return
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  function validate(): Errors {
    const found: Errors = {}
    for (const { key } of FIELDS) if (!values[key]) found[key] = REQUIRED[key]
    if (Object.keys(found).length) return found
    const changed = FIELDS.filter(({ key }) => values[key] !== original[key])
    if (!changed.length) return { form: NOTHING_CHANGED }
    // Changing an existing value needs a date; a first assignment (job not set yet) does not.
    if (changed.some(({ key }) => original[key]) && !effectiveDate) {
      return { effective_date: DATE_REQUIRED }
    }
    return {}
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const found = validate()
    setErrors(found)
    setSaveFailed(false)
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      await saveStructure(employee.id, {
        job_id: values.job_id || null,
        department_id: values.department_id || null,
        manager_id: values.manager_id || null,
        effective_date: effectiveDate || null,
      })
    } catch (err) {
      setSaving(false)
      if (err instanceof ApiError && err.status === 422 && err.fieldErrors) {
        const { form, ...rest } = err.fieldErrors
        setErrors(form ? { ...rest, form: NOTHING_CHANGED } : rest)
      } else {
        setSaveFailed(true)
      }
      return
    }
    onSaved()
    onClose()
  }

  return (
    <>
      <div className="backdrop" onClick={dismiss} />
      <aside
        ref={drawerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="structure-title"
        onKeyDown={onKeyDown}
      >
        <div className="drawer-head">
          <h2 id="structure-title">Change job, department or manager</h2>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={dismiss}>
            <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <form className="stack" noValidate onSubmit={onSubmit}>
          {(saveFailed || loadFailed) && (
            <div className="alert alert-danger" role="alert">
              <div>
                <strong>
                  {saveFailed ? 'The changes could not be saved.' : 'The choices could not be loaded.'}
                </strong>
                <span>Check your connection, then try again. The record has not changed.</span>
              </div>
            </div>
          )}
          {errors.form && (
            <div className="alert alert-warning" role="alert">
              <div>{errors.form}</div>
            </div>
          )}
          {FIELDS.map(({ key, label, placeholder, id }) => (
            <div className="field" key={key}>
              <label className="field-label" htmlFor={id}>
                {label}
              </label>
              <select
                className={`select${errors[key] ? ' is-invalid' : ''}`}
                id={id}
                value={values[key]}
                aria-invalid={errors[key] ? true : undefined}
                aria-describedby={errors[key] ? `${id}-err` : undefined}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              >
                <option value="">{placeholder}</option>
                {choices[key].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors[key] && (
                <span className="field-error" id={`${id}-err`} role="alert">
                  {errors[key]}
                </span>
              )}
            </div>
          ))}
          <div className="field">
            <label className="field-label" htmlFor="sd-date">
              Effective date
            </label>
            <input
              className={`input${errors.effective_date ? ' is-invalid' : ''}`}
              id="sd-date"
              type="date"
              value={effectiveDate}
              aria-invalid={errors.effective_date ? true : undefined}
              aria-describedby={errors.effective_date ? 'sd-date-err' : undefined}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
            {errors.effective_date && (
              <span className="field-error" id="sd-date-err" role="alert">
                {errors.effective_date}
              </span>
            )}
          </div>
          <div className="drawer-actions">
            <button type="button" className="btn btn-secondary" onClick={dismiss}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" aria-disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
