import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/client'
import {
  getEmployeeOptions,
  updateWorkDetails,
  type EmployeeOptions,
  type EmployeeView,
} from '../../api/employees'
import Drawer from '../../components/Drawer'
import Field from './Field'
import { validateWork, type Errors, type WorkField } from './validation'

interface Props {
  employee: EmployeeView
  onSaved: (employee: EmployeeView) => void
  onClose: () => void
}

export default function WorkDetailsDrawer({ employee, onSaved, onClose }: Props) {
  const [values, setValues] = useState<Record<WorkField, string>>({
    name: employee.name,
    job_title: employee.job_title,
    department: employee.department,
    manager_id: employee.manager_id ?? '',
  })
  const [options, setOptions] = useState<EmployeeOptions | null>(null)
  const [errors, setErrors] = useState<Errors<WorkField>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getEmployeeOptions()
      .then(setOptions)
      .catch((err: unknown) => setFormError(errorMessage(err, "We couldn't load the department and manager lists.")))
  }, [])

  const set = (field: WorkField) => (value: string) => setValues((current) => ({ ...current, [field]: value }))

  // The current manager stays choosable even if they have since left.
  const managers = (options?.managers ?? []).filter((m) => m.id !== employee.id)
  if (employee.manager_id && employee.manager_name && !managers.some((m) => m.id === employee.manager_id)) {
    managers.push({ id: employee.manager_id, name: employee.manager_name })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateWork(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    setFormError(null)
    try {
      onSaved(
        await updateWorkDetails(employee.id, {
          ...values,
          name: values.name.trim(),
          job_title: values.job_title.trim(),
          department: values.department.trim(),
        }),
      )
    } catch (err) {
      setFormError(errorMessage(err, "We couldn't save the work details. Try again."))
      setSaving(false)
    }
  }

  return (
    <Drawer title="Edit work details" closeLabel="Close work details" onClose={onClose}>
      <form className="stack" noValidate onSubmit={submit}>
        {formError && (
          <div className="alert alert-danger" role="alert">
            <span>{formError}</span>
          </div>
        )}
        <Field id="w-name" label="Full name" error={errors.name}>
          {(aria) => <input {...aria} value={values.name} onChange={(e) => set('name')(e.target.value)} />}
        </Field>
        <Field id="w-job" label="Job title" error={errors.job_title}>
          {(aria) => <input {...aria} value={values.job_title} onChange={(e) => set('job_title')(e.target.value)} />}
        </Field>
        <Field id="w-dept" label="Department" error={errors.department}>
          {(aria) => (
            <>
              <input
                {...aria}
                list="w-dept-list"
                value={values.department}
                onChange={(e) => set('department')(e.target.value)}
              />
              <datalist id="w-dept-list">
                {(options?.departments ?? []).map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field id="w-mgr" label="Manager" error={errors.manager_id}>
          {(aria) => (
            <select {...aria} value={values.manager_id} onChange={(e) => set('manager_id')(e.target.value)}>
              <option value="">Choose a manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="dd-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save work details'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Drawer>
  )
}
