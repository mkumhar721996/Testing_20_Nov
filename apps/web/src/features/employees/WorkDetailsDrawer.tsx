import { useEffect, useId, useState, type FormEvent } from 'react'
import { getEmployeeOptions, updateWorkDetails, type EmployeeOptions, type EmployeeView } from '../../api/employees'
import Drawer from '../../components/Drawer'
import Icon from '../../components/Icon'
import Field from './Field'
import { saveError, validateWork, type Errors, type WorkValues } from './validation'

type Props = { employee: EmployeeView; onSaved: (employee: EmployeeView) => void; onClose: () => void }

export default function WorkDetailsDrawer({ employee, onSaved, onClose }: Props) {
  const departmentsId = useId()
  const [values, setValues] = useState<WorkValues>({
    name: employee.name,
    job_title: employee.job_title,
    department: employee.department,
    manager_id: employee.manager_id ?? '',
  })
  const [options, setOptions] = useState<EmployeeOptions | null>(null)
  const [errors, setErrors] = useState<Errors<keyof WorkValues>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getEmployeeOptions().then(setOptions, (error: unknown) => setFailure(saveError(error)))
  }, [])

  const set = (key: keyof WorkValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }))
  const managers = (options?.managers ?? []).filter((m) => m.id !== employee.id)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateWork(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    setFailure(null)
    try {
      onSaved(await updateWorkDetails(employee.id, values))
    } catch (error) {
      setFailure(saveError(error))
      setSaving(false)
    }
  }

  return (
    <Drawer title="Edit work details" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        {failure && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <span>{failure}</span>
          </div>
        )}
        <Field label="Full name" error={errors.name}>
          {(p) => <input {...p} value={values.name} onChange={(e) => set('name')(e.target.value)} />}
        </Field>
        <Field label="Job title" error={errors.job_title}>
          {(p) => <input {...p} value={values.job_title} onChange={(e) => set('job_title')(e.target.value)} />}
        </Field>
        <Field label="Department" error={errors.department}>
          {(p) => (
            <>
              <input {...p} list={departmentsId} value={values.department} onChange={(e) => set('department')(e.target.value)} />
              <datalist id={departmentsId}>
                {(options?.departments ?? []).map((d) => (
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
