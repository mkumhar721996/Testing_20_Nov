import { ApiError } from '../../api/client'

export type Errors<K extends string> = Partial<Record<K, string>>

const blank = (value: string) => value.trim() === ''

function check<K extends string>(rules: Record<K, [string, string]>): Errors<K> {
  const errors: Errors<K> = {}
  for (const key of Object.keys(rules) as K[]) {
    const [value, message] = rules[key]
    if (blank(value)) errors[key] = message
  }
  return errors
}

export type WorkValues = { name: string; job_title: string; department: string; manager_id: string }

export const validateWork = (v: WorkValues) =>
  check<keyof WorkValues>({
    name: [v.name, "Enter the employee's full name."],
    job_title: [v.job_title, 'Enter a job title.'],
    department: [v.department, 'Enter a department.'],
    manager_id: [v.manager_id, 'Choose a manager.'],
  })

export type PersonalValues = {
  personal_phone: string
  home_address: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

export const validatePersonal = (v: PersonalValues) =>
  check<keyof PersonalValues>({
    personal_phone: [v.personal_phone, 'Enter a phone number like +44 7700 900123.'],
    home_address: [v.home_address, 'Enter your home address, including the postcode.'],
    emergency_contact_name: [v.emergency_contact_name, 'Enter who we should contact.'],
    emergency_contact_phone: [v.emergency_contact_phone, 'Enter a phone number like +44 7700 900456.'],
  })

export type CreateValues = WorkValues & { account_id: string }

export const validateCreate = (v: CreateValues) =>
  check<keyof CreateValues>({
    account_id: [v.account_id, 'Choose an employee to continue.'],
    name: [v.name, "Enter the employee's full name."],
    job_title: [v.job_title, 'Enter a job title, for example Payroll analyst.'],
    department: [v.department, 'Choose a department.'],
    manager_id: [v.manager_id, 'Choose a manager.'],
  })

/** What to show in a drawer when a save fails: the server's reason for 403/409/422. */
export function saveError(error: unknown): string {
  const fallback = "We couldn't save your changes. Nothing was changed. Try again in a moment."
  if (error instanceof ApiError && [403, 409, 422].includes(error.status)) {
    return apiMessage(error.body, 'Check the details and try again.')
  }
  return fallback
}

/** A readable message from an API error body, else a generic one. */
export function apiMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
    return body.detail
  }
  return fallback
}
