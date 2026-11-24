import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { OPTIONS, fullView, requestsTo, stubFetch, type Routes } from '../../testing/fetchStub'
import CreateEmployeePage from './CreateEmployeePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function renderCreate(routes: Routes = {}) {
  const mock = stubFetch({ 'GET /employees/options': { body: OPTIONS }, ...routes })
  render(
    <MemoryRouter>
      <CreateEmployeePage />
    </MemoryRouter>,
  )
  await screen.findByRole('option', { name: /Lucía Fernández/ })
  return mock
}

const fill = async (accountId: string) => {
  fireEvent.change(screen.getByLabelText('Employee'), { target: { value: accountId } })
  fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Payroll analyst' } })
  fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'Finance' } })
  fireEvent.change(screen.getByLabelText('Manager'), { target: { value: 'mgr-1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))
}

it('asks for an employee when none is chosen', async () => {
  const mock = await renderCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))
  expect(await screen.findByText('Choose an employee to continue.')).toBeInTheDocument()
  expect(requestsTo(mock, 'POST /employees')).toHaveLength(0)
})

it('AC1: creates the profile and links to it', async () => {
  await renderCreate({
    'POST /employees': { status: 201, body: fullView({ id: 'new-1', name: 'Lucía Fernández' }) },
  })
  await fill('acc-31')
  expect(await screen.findByText('Profile created for Lucía Fernández.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open profile' })).toHaveAttribute('href', '/employees/new-1')
})

it('AC2: a duplicate shows the refusal and a link to the existing profile', async () => {
  await renderCreate({
    'POST /employees': {
      status: 409,
      body: { detail: 'This employee already has a profile.', existing_employee_id: 'emp-7' },
    },
  })
  await fill('acc-07')
  expect(await screen.findByText(/already has a profile/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open existing profile' })).toHaveAttribute('href', '/employees/emp-7')
})

it('shows the not-available state when the caller is not HR', async () => {
  stubFetch({ 'GET /employees/options': { status: 403, body: { detail: 'x' } } })
  render(
    <MemoryRouter>
      <CreateEmployeePage />
    </MemoryRouter>,
  )
  expect(await screen.findByRole('heading', { name: "This page isn't available" })).toBeInTheDocument()
})
