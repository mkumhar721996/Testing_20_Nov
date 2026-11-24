import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/client'
import { updatePersonalDetails, type EmployeeView, type PersonalDetails } from '../../api/employees'
import Drawer from '../../components/Drawer'
import Field from './Field'
import { validatePersonal, type Errors, type PersonalField } from './validation'

interface Props {
  employeeId: string
  current: PersonalDetails
  onSaved: (employee: EmployeeView) => void
  onClose: () => void
}

export default function PersonalDetailsDrawer({ employeeId, current, onSaved, onClose }: Props) {
  const [values, setValues] = useState<Record<PersonalField, string>>({
    personal_phone: current.personal_phone ?? '',
    home_address: current.home_address ?? '',
    emergency_contact_name: current.emergency_contact_name ?? '',
    emergency_contact_phone: current.emergency_contact_phone ?? '',
  })
  const [errors, setErrors] = useState<Errors<PersonalField>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (field: PersonalField) => (value: string) => setValues((v) => ({ ...v, [field]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validatePersonal(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    setFormError(null)
    try {
      onSaved(
        await updatePersonalDetails(employeeId, {
          personal_phone: values.personal_phone.trim(),
          home_address: values.home_address.trim(),
          emergency_contact_name: values.emergency_contact_name.trim(),
          emergency_contact_phone: values.emergency_contact_phone.trim(),
        }),
      )
    } catch (err) {
      setFormError(errorMessage(err, "We couldn't save your contact details. Try again."))
      setSaving(false)
    }
  }

  return (
    <Drawer title="Edit contact details" closeLabel="Close contact details" onClose={onClose}>
      <form className="stack" noValidate onSubmit={submit}>
        {formError && (
          <div className="alert alert-danger" role="alert">
            <span>{formError}</span>
          </div>
        )}
        <Field id="p-phone" label="Personal phone" error={errors.personal_phone}>
          {(aria) => (
            <input {...aria} type="tel" value={values.personal_phone} onChange={(e) => set('personal_phone')(e.target.value)} />
          )}
        </Field>
        <Field id="p-address" label="Home address" error={errors.home_address}>
          {(aria) => (
            <textarea {...aria} value={values.home_address} onChange={(e) => set('home_address')(e.target.value)} />
          )}
        </Field>
        <Field
          id="p-ecname"
          label="Emergency contact name"
          hint={'Add how they are related to you, for example "Tobias Okafor (brother)".'}
          error={errors.emergency_contact_name}
        >
          {(aria) => (
            <input
              {...aria}
              value={values.emergency_contact_name}
              onChange={(e) => set('emergency_contact_name')(e.target.value)}
            />
          )}
        </Field>
        <Field id="p-ecphone" label="Emergency contact phone" error={errors.emergency_contact_phone}>
          {(aria) => (
            <input
              {...aria}
              type="tel"
              value={values.emergency_contact_phone}
              onChange={(e) => set('emergency_contact_phone')(e.target.value)}
            />
          )}
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
