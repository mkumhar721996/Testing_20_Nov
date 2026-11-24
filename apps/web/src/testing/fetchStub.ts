import { vi } from 'vitest'
import type { EmployeeFullView, EmployeeWorkView } from '../api/employees'

export const PERSONAL = {
  personal_phone: '+44 7700 900123',
  home_address: '14 Alder Court\nLeeds LS6 2AB',
  emergency_contact_name: 'Tobias Okafor (brother)',
  emergency_contact_phone: '+44 7700 900456',
}

export const HR_VIEWER = { can_edit_work: true, can_edit_personal: false, can_mark_leaver: true }
export const OWN_VIEWER = { can_edit_work: false, can_edit_personal: true, can_mark_leaver: false }
export const NO_VIEWER = { can_edit_work: false, can_edit_personal: false, can_mark_leaver: false }

export function fullView(overrides: Partial<EmployeeFullView> = {}): EmployeeFullView {
  return {
    id: 'emp-1',
    name: 'Amara Okafor',
    job_title: 'Senior accountant',
    department: 'Finance',
    manager_id: 'mgr-1',
    manager_name: 'Daniel Whitfield',
    work_email: 'amara.okafor@comp.example',
    status: 'active',
    viewer: HR_VIEWER,
    personal: PERSONAL,
    ...overrides,
  }
}

export function workView(overrides: Partial<EmployeeWorkView> = {}): EmployeeWorkView {
  const { personal: _personal, ...rest } = fullView({ viewer: NO_VIEWER })
  return { ...rest, ...overrides }
}

export const OPTIONS = {
  accounts: [
    { id: 'acc-31', name: 'Lucía Fernández', email: 'lucia.fernandez@comp.example', has_profile: false },
    { id: 'acc-07', name: 'Amara Okafor', email: 'amara.okafor@comp.example', has_profile: true },
  ],
  departments: ['Finance', 'Sales'],
  managers: [
    { id: 'mgr-1', name: 'Daniel Whitfield' },
    { id: 'mgr-2', name: 'Grace Lindqvist' },
  ],
}

type Reply = { status?: number; body: unknown }
export type Routes = Record<string, Reply | ((init: RequestInit) => Reply)>

/** Stubs `fetch`; routes are keyed "METHOD /path". Unknown routes fail the test. */
export function stubFetch(routes: Routes) {
  const mock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${new URL(url).pathname}`
    const route = routes[key]
    if (!route) throw new Error(`Unexpected request: ${key}`)
    const reply = typeof route === 'function' ? route(init) : route
    const status = reply.status ?? 200
    return { ok: status < 400, status, json: async () => reply.body } as Response
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

export const requestsTo = (mock: ReturnType<typeof stubFetch>, key: string) =>
  mock.mock.calls.filter(([url, init]) => `${(init as RequestInit)?.method ?? 'GET'} ${new URL(url as string).pathname}` === key)
