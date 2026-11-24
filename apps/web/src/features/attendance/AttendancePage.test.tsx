import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AttendancePage from './AttendancePage'

// @testing-library/user-event is not a project dependency; fireEvent is enough here.
const userEvent = {
  setup: () => ({
    click: async (el: Element) => {
      fireEvent.click(el)
    },
  }),
}

type Rec = { id: string; date: string; clock_in_at: string; clock_out_at: string | null }

const closed: Rec = {
  id: '1',
  date: '2026-11-23',
  clock_in_at: new Date(2026, 10, 23, 8, 58).toISOString(),
  clock_out_at: new Date(2026, 10, 23, 17, 12).toISOString(),
}
const open: Rec = {
  id: '2',
  date: '2026-11-24',
  clock_in_at: new Date(2026, 10, 24, 9, 2).toISOString(),
  clock_out_at: null,
}

let records: Rec[]
let calls: string[]
let refuse: { status: number; code: string } | null
let listFails: boolean

function json(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

beforeEach(() => {
  records = []
  calls = []
  refuse = null
  listFails = false
  // "Since 09:02 today" depends on today's date; fake only Date so async waits still work.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 24, 12, 0))
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${url}`)
      if (method === 'GET') {
        return listFails ? json(500, {}) : json(200, records)
      }
      if (refuse) return json(refuse.status, { detail: { code: refuse.code, message: 'x' } })
      if (url.endsWith('/clock-in')) {
        records = [open, ...records]
        return json(201, open)
      }
      records = records.map((r) => (r.clock_out_at ? r : { ...r, clock_out_at: new Date(2026, 10, 24, 17, 31).toISOString() }))
      return json(200, records[0])
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('shows loading skeleton first', () => {
  render(<AttendancePage />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading your attendance records')
})

it('shows the empty state with one Clock in button', async () => {
  render(<AttendancePage />)
  expect(await screen.findByRole('heading', { name: 'No attendance records yet' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Clock in' })).toHaveLength(1)
})

it('clock in flips the status to clocked in (AC1)', async () => {
  const user = userEvent.setup()
  render(<AttendancePage />)
  await user.click(await screen.findByRole('button', { name: 'Clock in' }))
  expect(await screen.findByText('Clocked in')).toBeInTheDocument()
})

it('clock out flips the status to clocked out (AC2)', async () => {
  records = [open]
  const user = userEvent.setup()
  render(<AttendancePage />)
  await screen.findByText('Clocked in')
  await user.click(screen.getByRole('button', { name: 'Clock out' }))
  expect(await screen.findByText('Clocked out')).toBeInTheDocument()
})

it('refused clock in shows an alert and keeps the original time (AC6/7)', async () => {
  records = [open]
  refuse = { status: 409, code: 'already_clocked_in' }
  const user = userEvent.setup()
  render(<AttendancePage />)
  await screen.findByText('Clocked in')
  await user.click(screen.getByRole('button', { name: 'Clock in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('You are already clocked in')
  expect(screen.getByText('Since 09:02 today')).toBeInTheDocument()
})

it('refused clock out shows an alert and adds no row (AC8/9)', async () => {
  records = [closed]
  refuse = { status: 409, code: 'not_clocked_in' }
  const user = userEvent.setup()
  render(<AttendancePage />)
  await screen.findByText('Mon 23 Nov 2026')
  const rowsBefore = screen.getAllByRole('row').length
  await user.click(screen.getByRole('button', { name: 'Clock out' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('You are not clocked in')
  expect(screen.getAllByRole('row')).toHaveLength(rowsBefore)
})

it('refusal naming another employee shows an alert', async () => {
  refuse = { status: 403, code: 'other_employee' }
  records = [closed]
  const user = userEvent.setup()
  render(<AttendancePage />)
  await user.click(await screen.findByRole('button', { name: 'Clock in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Request refused')
})

it('lists records in API order with date and times (AC3/10)', async () => {
  records = [open, closed]
  render(<AttendancePage />)
  const rows = await screen.findAllByRole('row')
  expect(rows[1]).toHaveTextContent('Tue 24 Nov 2026')
  expect(within(rows[2]).getByText('Mon 23 Nov 2026')).toBeInTheDocument()
  expect(within(rows[2]).getByText('08:58')).toBeInTheDocument()
  expect(within(rows[2]).getByText('17:12')).toBeInTheDocument()
})

it('shows an error with Try again that re-fetches', async () => {
  listFails = true
  const user = userEvent.setup()
  render(<AttendancePage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Your records did not load')
  listFails = false
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('heading', { name: 'No attendance records yet' })).toBeInTheDocument()
})
