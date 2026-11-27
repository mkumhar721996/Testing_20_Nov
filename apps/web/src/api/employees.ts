import { apiRequest } from './client'

export type Viewer = {
  can_edit_work: boolean
  can_edit_personal: boolean
  can_mark_leaver: boolean
}

export type PersonalDetails = {
  personal_phone: string | null
  home_address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}

export type EmployeeWorkView = {
  id: string
  account_id: string
  name: string
  job_title: string
  department: string
  manager_id: string | null
  manager_name: string | null
  work_email: string
  status: 'active' | 'inactive'
  viewer: Viewer
}

/** Only sent to the employee and HR admins; absent for everyone else. */
export type EmployeeFullView = EmployeeWorkView & { personal: PersonalDetails }

export type EmployeeView = EmployeeWorkView | EmployeeFullView

export type WorkDetailsInput = {
  name: string
  job_title: string
  department: string
  manager_id: string
}

export type CreateEmployeeInput = WorkDetailsInput & { account_id: string }

export type PersonalDetailsInput = {
  personal_phone: string
  home_address: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

export type EmployeeOptions = {
  accounts: { id: string; name: string; email: string; has_profile: boolean }[]
  departments: string[]
  managers: { id: string; name: string }[]
}

export const hasPersonal = (e: EmployeeView): e is EmployeeFullView => 'personal' in e

export const getEmployee = (id: string) => apiRequest<EmployeeView>(`/employees/${id}`)
export const getMyEmployee = () => apiRequest<EmployeeView>('/employees/me')
export const getEmployeeOptions = () => apiRequest<EmployeeOptions>('/employees/options')
export const createEmployee = (input: CreateEmployeeInput) =>
  apiRequest<EmployeeFullView>('/employees', { method: 'POST', body: input })
export const updateWorkDetails = (id: string, input: WorkDetailsInput) =>
  apiRequest<EmployeeView>(`/employees/${id}/work`, { method: 'PATCH', body: input })
export const updatePersonalDetails = (id: string, input: PersonalDetailsInput) =>
  apiRequest<EmployeeView>(`/employees/${id}/personal`, { method: 'PATCH', body: input })
export const markLeaver = (id: string) =>
  apiRequest<EmployeeView>(`/employees/${id}/leaver`, { method: 'POST' })
