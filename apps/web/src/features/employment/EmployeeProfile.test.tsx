import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import type { Employee } from '../../api/types'
import { EmployeeProfile } from './EmployeeProfile'

vi.mock('../../api/client', () => ({
  ApiError: class extends Error {},
  getEmployee: vi.fn(),
  getJobs: vi.fn(),
  getDepartments: vi.fn(),
  getManagers: vi.fn(),
  saveStructure: vi.fn(),
}))

const employee = (over: Partial<Employee> = {}): Employee => ({
  id: 'e1',
  name: 'Priya Nair',
  job: { id: 'j2', name: 'Senior accountant' },
  department: { id: 'd1', name: 'Finance' },
  manager: { id: 'm1', name: 'Hannah Brooks' },
  viewer: 'hr',
  ...over,
})

const JOBS = [
  { id: 'j1', name: 'Accountant' },
  { id: 'j2', name: 'Senior accountant' },
]
const DEPARTMENTS = [
  { id: 'd1', name: 'Finance' },
  { id: 'd2', name: 'Engineering' },
]
const MANAGERS = [
  { id: 'm1', name: 'Hannah Brooks' },
  { id: 'm2', name: 'Daniel Whitfield' },
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(client.getEmployee).mockResolvedValue(employee())
  vi.mocked(client.getJobs).mockResolvedValue(JOBS)
  vi.mocked(client.getDepartments).mockResolvedValue(DEPARTMENTS)
  vi.mocked(client.getManagers).mockResolvedValue(MANAGERS)
  vi.mocked(client.saveStructure).mockResolvedValue()
})

const renderProfile = () => render(<EmployeeProfile employeeId="e1" onViewHistory={() => {}} />)

async function openDrawer() {
  const user = userEvent.setup()
  renderProfile()
  await user.click(await screen.findByRole('button', { name: 'Change job, department or manager' }))
  await screen.findByRole('option', { name: 'Engineering' })
  return user
}

describe('profile', () => {
  it('shows the current job, department and manager (AC1)', async () => {
    renderProfile()
    expect(await screen.findByText('Senior accountant')).toBeInTheDocument()
    expect(screen.getByText('Current job')).toBeInTheDocument()
  })

  it('HR sees change and history actions', async () => {
    renderProfile()
    expect(await screen.findByRole('button', { name: 'View history' })).toBeInTheDocument()
  })

  it('the employee sees only their own history entry (AC9)', async () => {
    vi.mocked(client.getEmployee).mockResolvedValue(employee({ viewer: 'self' }))
    renderProfile()
    expect(await screen.findByRole('button', { name: 'View my history' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change job, department or manager' })).toBeNull()
  })

  it('a manager has no history entry point (AC10)', async () => {
    vi.mocked(client.getEmployee).mockResolvedValue(employee({ viewer: 'manager' }))
    renderProfile()
    await screen.findByText('Senior accountant')
    expect(screen.queryByRole('button', { name: /history/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /change job/i })).toBeNull()
  })

  it('shows only the new department and manager after a save (AC3, AC6)', async () => {
    vi.mocked(client.getEmployee)
      .mockResolvedValueOnce(employee())
      .mockResolvedValue(
        employee({
          department: { id: 'd2', name: 'Engineering' },
          manager: { id: 'm2', name: 'Daniel Whitfield' },
        }),
      )
    const user = await openDrawer()
    await user.selectOptions(screen.getByLabelText('Department'), 'd2')
    await user.selectOptions(screen.getByLabelText('Manager'), 'm2')
    await user.type(screen.getByLabelText('Effective date'), '2024-03-01')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(client.saveStructure).toHaveBeenCalledWith('e1', {
      job_id: 'j2',
      department_id: 'd2',
      manager_id: 'm2',
      effective_date: '2024-03-01',
    })
    const details = screen.getByRole('region', { name: 'Work details' })
    expect(await screen.findByText('Daniel Whitfield', { selector: 'dd' })).toBeInTheDocument()
    expect(details).toHaveTextContent('Engineering')
    expect(details).not.toHaveTextContent('Finance')
    expect(details).not.toHaveTextContent('Hannah Brooks')
    expect(screen.getByRole('status')).toHaveTextContent('saved')
  })
})

describe('drawer', () => {
  it('lists departments as a single level (AC4)', async () => {
    await openDrawer()
    const select = screen.getByLabelText('Department')
    expect(select.querySelector('optgroup')).toBeNull()
    const names = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    expect(names).toEqual(['Choose a department', 'Finance', 'Engineering'])
  })

  it('refuses a save with no department (AC2)', async () => {
    const user = await openDrawer()
    await user.selectOptions(screen.getByLabelText('Department'), '')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(
      screen.getByText("Choose a department. The record can't be saved without one."),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Department')).toHaveAttribute('aria-invalid', 'true')
    expect(client.saveStructure).not.toHaveBeenCalled()
  })

  it('refuses a save with no manager (AC5)', async () => {
    const user = await openDrawer()
    await user.selectOptions(screen.getByLabelText('Manager'), '')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(
      screen.getByText("Choose a manager. The record can't be saved without one."),
    ).toBeInTheDocument()
    expect(client.saveStructure).not.toHaveBeenCalled()
  })

  it('needs an effective date when something changed (AC7)', async () => {
    const user = await openDrawer()
    await user.selectOptions(screen.getByLabelText('Job'), 'j1')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByText('Enter the date the change takes effect.')).toBeInTheDocument()
    expect(client.saveStructure).not.toHaveBeenCalled()
  })

  it('warns when nothing has changed', async () => {
    const user = await openDrawer()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByText(/Nothing has changed/)).toBeInTheDocument()
    expect(client.saveStructure).not.toHaveBeenCalled()
  })

  it('is a labelled dialog that Escape closes', async () => {
    const user = await openDrawer()
    expect(screen.getByRole('dialog', { name: 'Change job, department or manager' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
