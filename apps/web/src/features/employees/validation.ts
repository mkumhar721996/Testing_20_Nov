export type Errors<K extends string> = Partial<Record<K, string>>

const blank = (value: string) => value.trim() === ''

export type WorkField = 'name' | 'job_title' | 'department' | 'manager_id'

export function validateWork(values: Record<WorkField, string>): Errors<WorkField> {
  const errors: Errors<WorkField> = {}
  if (blank(values.name)) errors.name = "Enter the employee's full name."
  if (blank(values.job_title)) errors.job_title = 'Enter a job title.'
  if (blank(values.department)) errors.department = 'Choose a department.'
  if (blank(values.manager_id)) errors.manager_id = 'Choose a manager.'
  return errors
}

export type CreateField = 'account_id' | WorkField

export function validateCreate(values: Record<CreateField, string>): Errors<CreateField> {
  const errors: Errors<CreateField> = validateWork(values)
  if (blank(values.account_id)) errors.account_id = 'Choose an employee to continue.'
  if (blank(values.job_title)) errors.job_title = 'Enter a job title, for example Payroll analyst.'
  return errors
}

export type PersonalField =
  | 'personal_phone'
  | 'home_address'
  | 'emergency_contact_name'
  | 'emergency_contact_phone'

export function validatePersonal(values: Record<PersonalField, string>): Errors<PersonalField> {
  const errors: Errors<PersonalField> = {}
  if (blank(values.personal_phone)) errors.personal_phone = 'Enter a phone number like +44 7700 900123.'
  if (blank(values.home_address)) errors.home_address = 'Enter your home address, including the postcode.'
  if (blank(values.emergency_contact_name)) errors.emergency_contact_name = 'Enter who we should contact.'
  if (blank(values.emergency_contact_phone))
    errors.emergency_contact_phone = 'Enter a phone number like +44 7700 900456.'
  return errors
}
