import { apiFetch } from './client'

export interface Viewer {
  can_edit_work: boolean
  can_edit_personal: boolean
  can_mark_leaver: boolean
}

export interface PersonalDetails {
  personal_phone: string | null
  home_address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}

export interface EmployeeWorkView {
  id: string
  name: string
  job_title: string
  department: string
  manager_id: string | null
  manager_name: string | null
  work_email: string
  status: 'active' | 'inactive'
  viewer: Viewer
}

/** `personal` is absent (not null) unless the viewer is the employee or an HR admin. */
export interface EmployeeFullView extends EmployeeWorkView {
  personal: PersonalDetails
}

export type EmployeeView = EmployeeWorkView | EmployeeFullView

export interface WorkDetailsInput {
  name: string
  job_title: string
  department: string
  manager_id: string
}

export interface CreateEmployeeInput extends WorkDetailsInput {
  account_id: string
}

export interface PersonalDetailsInput {
  personal_phone: string
  home_address: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

export interface EmployeeOptions {
  accounts: { id: string; name: string; email: string; has_profile: boolean }[]
  departments: string[]
  managers: { id: string; name: string }[]
}

export const getEmployee = (id: string) => apiFetch<EmployeeView>(`/employees/${id}`)
export const getMyEmployee = () => apiFetch<EmployeeView>('/employees/me')
export const getEmployeeOptions = () => apiFetch<EmployeeOptions>('/employees/options')
export const createEmployee = (body: CreateEmployeeInput) =>
  apiFetch<EmployeeFullView>('/employees', { method: 'POST', body })
export const updateWorkDetails = (id: string, body: WorkDetailsInput) =>
  apiFetch<EmployeeView>(`/employees/${id}/work`, { method: 'PATCH', body })
export const updatePersonalDetails = (id: string, body: PersonalDetailsInput) =>
  apiFetch<EmployeeView>(`/employees/${id}/personal`, { method: 'PATCH', body })
export const markLeaver = (id: string) =>
  apiFetch<EmployeeView>(`/employees/${id}/leaver`, { method: 'POST' })

export function hasPersonal(employee: EmployeeView): employee is EmployeeFullView {
  return 'personal' in employee
}
