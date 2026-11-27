import { screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { OPTIONS, employeeView, fireUser, mockApi, renderAt } from './testing'

afterEach(() => vi.unstubAllGlobals())

async function fillForm(accountId: string) {
  await fireUser.selectOptions(await screen.findByLabelText('Employee'), accountId)
  await fireUser.type(screen.getByLabelText('Job title'), 'Payroll analyst')
  await fireUser.type(screen.getByLabelText('Department'), 'Finance')
  await fireUser.selectOptions(screen.getByLabelText('Manager'), 'm-1')
  await fireUser.click(screen.getByRole('button', { name: 'Create profile' }))
}

it('asks HR to choose an employee before saving', async () => {
  mockApi({ 'GET /employees/options': { body: OPTIONS } })
  renderAt('/employees/new')
  await fireUser.click(await screen.findByRole('button', { name: 'Create profile' }))
  expect(await screen.findByText('Choose an employee to continue.')).toBeInTheDocument()
  expect(screen.getByText('Enter a job title, for example Payroll analyst.')).toBeInTheDocument()
})

it('marks accounts that already have a profile', async () => {
  mockApi({ 'GET /employees/options': { body: OPTIONS } })
  renderAt('/employees/new')
  expect(await screen.findByRole('option', { name: 'Amara Okafor (profile exists)' })).toBeInTheDocument()
})

it('creates the profile and offers to open it (AC1)', async () => {
  const calls = mockApi({
    'GET /employees/options': { body: OPTIONS },
    'POST /employees': { status: 201, body: employeeView({ id: 'new-1', name: 'Lucía Fernández' }) },
  })
  renderAt('/employees/new')
  await fillForm('acc-1')
  expect(await screen.findByText('Profile created for Lucía Fernández.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open profile' })).toHaveAttribute('href', '/employees/new-1')
  expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
    account_id: 'acc-1',
    name: 'Lucía Fernández',
    job_title: 'Payroll analyst',
    department: 'Finance',
    manager_id: 'm-1',
  })
})

it('refuses a second profile and links to the existing one (AC2)', async () => {
  mockApi({
    'GET /employees/options': { body: OPTIONS },
    'POST /employees': {
      status: 409,
      body: { detail: 'This employee already has a profile.', existing_employee_id: 'e-1' },
    },
  })
  renderAt('/employees/new')
  await fillForm('acc-2')
  expect(await screen.findByText(/already has a profile/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open existing profile' })).toHaveAttribute(
    'href',
    '/employees/e-1',
  )
})

it('shows the not-available state to someone who is not an HR admin', async () => {
  mockApi({ 'GET /employees/options': { status: 403, body: { detail: 'no' } } })
  renderAt('/employees/new')
  expect(await screen.findByRole('heading', { name: "This page isn't available" })).toBeInTheDocument()
})
