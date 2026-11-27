import { fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from '../../App'
import type { EmployeeFullView, EmployeeOptions, EmployeeWorkView } from '../../api/employees'

export const PERSONAL = {
  personal_phone: '+44 7700 900123',
  home_address: '14 Alder Court\nLeeds LS6 2AB',
  emergency_contact_name: 'Tobias Okafor (brother)',
  emergency_contact_phone: '+44 7700 900456',
}

export const OPTIONS: EmployeeOptions = {
  accounts: [
    { id: 'acc-1', name: 'Lucía Fernández', email: 'lucia@comp.example', has_profile: false },
    { id: 'acc-2', name: 'Amara Okafor', email: 'amara@comp.example', has_profile: true },
  ],
  departments: ['Finance', 'Sales'],
  managers: [
    { id: 'm-1', name: 'Daniel Whitfield' },
    { id: 'm-2', name: 'Grace Lindqvist' },
  ],
}

type Overrides = Partial<EmployeeFullView> & { withoutPersonal?: boolean }

export function employeeView(overrides: Overrides = {}): EmployeeFullView | EmployeeWorkView {
  const { withoutPersonal, ...rest } = overrides
  const base: EmployeeFullView = {
    id: 'e-1',
    account_id: 'acc-2',
    name: 'Amara Okafor',
    job_title: 'Senior accountant',
    department: 'Finance',
    manager_id: 'm-1',
    manager_name: 'Daniel Whitfield',
    work_email: 'amara.okafor@comp.example',
    status: 'active',
    viewer: { can_edit_work: false, can_edit_personal: false, can_mark_leaver: false },
    personal: PERSONAL,
    ...rest,
  }
  if (withoutPersonal) {
    const { personal: _personal, ...work } = base
    void _personal
    return work
  }
  return base
}

export const HR_VIEWER = { can_edit_work: true, can_edit_personal: false, can_mark_leaver: true }
export const OWN_VIEWER = { can_edit_work: false, can_edit_personal: true, can_mark_leaver: false }

export type Call = { method: string; path: string; body: unknown }

/** Stubs fetch: `routes` maps "METHOD /path" to a status and body (or a function of the request). */
export function mockApi(
  routes: Record<string, { status?: number; body?: unknown } | ((body: unknown) => { status?: number; body?: unknown })>,
) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const path = new URL(url).pathname
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ method, path, body })
      const route = routes[`${method} ${path}`]
      if (!route) return new Response(JSON.stringify({ detail: 'unmocked' }), { status: 500 })
      const { status = 200, body: out } = typeof route === 'function' ? route(body) : route
      return new Response(JSON.stringify(out ?? null), { status })
    }),
  )
  return calls
}

/** Minimal user-event stand-in built on fireEvent (user-event is not a project dependency). */
export const fireUser = {
  click: async (el: Element) => void fireEvent.click(el),
  clear: async (el: Element) => void fireEvent.change(el, { target: { value: '' } }),
  type: async (el: Element, text: string) =>
    void fireEvent.change(el, { target: { value: (el as HTMLInputElement).value + text } }),
  selectOptions: async (el: Element, value: string) =>
    void fireEvent.change(el, { target: { value } }),
}

export function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}
