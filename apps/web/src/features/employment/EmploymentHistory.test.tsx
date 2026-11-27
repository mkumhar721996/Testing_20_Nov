import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import type { Employee } from '../../api/types'
import { EmploymentHistory } from './EmploymentHistory'

vi.mock('../../api/client', () => ({
  ApiError: class extends Error {
    constructor(public status: number) {
      super(`API ${status}`)
    }
  },
  getEmployee: vi.fn(),
  getEmploymentHistory: vi.fn(),
}))

const employee = (viewer: Employee['viewer']) =>
  ({ id: 'e1', name: 'P', job: null, department: { id: 'd', name: 'D' }, manager: { id: 'm', name: 'M' }, viewer }) as Employee

const renderHistory = () =>
  render(<EmploymentHistory employeeId="e1" onBack={() => {}} onChange={() => {}} />)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(client.getEmployee).mockResolvedValue(employee('hr'))
})

it('shows each change with its effective date, field and previous value (AC8, AC9)', async () => {
  vi.mocked(client.getEmploymentHistory).mockResolvedValue([
    { id: '1', field: 'manager', from_name: 'Hannah Brooks', to_name: 'Daniel Whitfield', effective_date: '2024-03-01' },
    { id: '2', field: 'job', from_name: null, to_name: 'Accountant', effective_date: '2023-01-15' },
  ])
  renderHistory()
  expect(await screen.findByText('1 March 2024')).toBeInTheDocument()
  expect(screen.getByText('manager')).toBeInTheDocument()
  expect(screen.getByText('(was Hannah Brooks)')).toBeInTheDocument()
  const rows = screen.getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('1 March 2024')
  expect(rows[1]).toHaveTextContent('15 January 2023')
})

it('shows an empty state with the change action for HR', async () => {
  vi.mocked(client.getEmploymentHistory).mockResolvedValue([])
  renderHistory()
  expect(await screen.findByText('No changes recorded yet')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Change job, department or manager' })).toBeInTheDocument()
})

it('shows no list to someone who may not see history (AC10)', async () => {
  vi.mocked(client.getEmploymentHistory).mockRejectedValue(new (client.ApiError as never as new (s: number) => Error)(403))
  renderHistory()
  expect(await screen.findByText("Employment history isn't available to you")).toBeInTheDocument()
  expect(screen.queryByRole('list')).toBeNull()
})

it('offers to try again when loading fails', async () => {
  vi.mocked(client.getEmploymentHistory).mockRejectedValue(new Error('boom'))
  renderHistory()
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
})
