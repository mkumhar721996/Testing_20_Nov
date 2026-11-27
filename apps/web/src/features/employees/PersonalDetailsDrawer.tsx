import { useState, type FormEvent } from 'react'
import { updatePersonalDetails, type EmployeeView, type PersonalDetails } from '../../api/employees'
import Drawer from '../../components/Drawer'
import Icon from '../../components/Icon'
import Field from './Field'
import { saveError, validatePersonal, type Errors, type PersonalValues } from './validation'

type Props = {
  employeeId: string
  current: PersonalDetails
  onSaved: (employee: EmployeeView) => void
  onClose: () => void
}

export default function PersonalDetailsDrawer({ employeeId, current, onSaved, onClose }: Props) {
  const [values, setValues] = useState<PersonalValues>({
    personal_phone: current.personal_phone ?? '',
    home_address: current.home_address ?? '',
    emergency_contact_name: current.emergency_contact_name ?? '',
    emergency_contact_phone: current.emergency_contact_phone ?? '',
  })
  const [errors, setErrors] = useState<Errors<keyof PersonalValues>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (key: keyof PersonalValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validatePersonal(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    setFailure(null)
    try {
      onSaved(await updatePersonalDetails(employeeId, values))
    } catch (error) {
      setFailure(saveError(error))
      setSaving(false)
    }
  }

  return (
    <Drawer title="Edit contact details" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        {failure && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <span>{failure}</span>
          </div>
        )}
        <Field label="Personal phone" error={errors.personal_phone}>
          {(p) => <input {...p} type="tel" value={values.personal_phone} onChange={(e) => set('personal_phone')(e.target.value)} />}
        </Field>
        <Field label="Home address" error={errors.home_address}>
          {(p) => <textarea {...p} className={`textarea ${p.className}`} value={values.home_address} onChange={(e) => set('home_address')(e.target.value)} />}
        </Field>
        <Field
          label="Emergency contact name"
          hint='Add how they are related to you, for example "Tobias Okafor (brother)".'
          error={errors.emergency_contact_name}
        >
          {(p) => <input {...p} value={values.emergency_contact_name} onChange={(e) => set('emergency_contact_name')(e.target.value)} />}
        </Field>
        <Field label="Emergency contact phone" error={errors.emergency_contact_phone}>
          {(p) => <input {...p} type="tel" value={values.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone')(e.target.value)} />}
        </Field>
        <div className="dd-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save contact details'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Drawer>
  )
}
