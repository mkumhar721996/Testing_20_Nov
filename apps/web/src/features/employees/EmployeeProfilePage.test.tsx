import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OPTIONS,
  OWN_VIEWER,
  fullView,
  requestsTo,
  stubFetch,
  workView,
  type Routes as StubRoutes,
} from '../../testing/fetchStub'
import EmployeeProfilePage from './EmployeeProfilePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderProfile(routes: StubRoutes) {
  const mock = stubFetch({ 'GET /employees/options': { body: OPTIONS }, ...routes })
  render(
    <MemoryRouter initialEntries={['/employees/emp-1']}>
      <Routes>
        <Route path="/employees/:employeeId" element={<EmployeeProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
  return mock
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('HR view', () => {
  it('AC3: HR edits the job title and sees it, with a toast', async () => {
    renderProfile({
      'GET /employees/emp-1': { body: fullView() },
      'PATCH /employees/emp-1/work': { body: fullView({ job_title: 'Finance lead' }) },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Edit work details' }))
    type('Job title', 'Finance lead')
    fireEvent.click(screen.getByRole('button', { name: 'Save work details' }))
    expect((await screen.findAllByText(/Finance lead/)).length).toBeGreaterThan(0)
    expect(await screen.findByText('Work details saved.')).toBeInTheDocument()
  })

  it('AC3: a blank name shows the error and sends no PATCH', async () => {
    const mock = renderProfile({ 'GET /employees/emp-1': { body: fullView() } })
    fireEvent.click(await screen.findByRole('button', { name: 'Edit work details' }))
    type('Full name', '')
    fireEvent.click(screen.getByRole('button', { name: 'Save work details' }))
    expect(await screen.findByText("Enter the employee's full name.")).toBeInTheDocument()
    expect(requestsTo(mock, 'PATCH /employees/emp-1/work')).toHaveLength(0)
  })

  it('AC6: marking a leaver confirms, then shows Inactive and no edit actions', async () => {
    renderProfile({
      'GET /employees/emp-1': { body: fullView() },
      'POST /employees/emp-1/leaver': {
        body: fullView({ status: 'inactive', viewer: { ...OWN_VIEWER, can_edit_personal: false } }),
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as leaver' }))
    const dialog = screen.getByRole('dialog', { name: 'Mark Amara Okafor as a leaver?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark as leaver' }))
    expect(await screen.findByText('Inactive')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit work details' })).not.toBeInTheDocument()
    expect(await screen.findByText('Amara Okafor is marked as a leaver.')).toBeInTheDocument()
  })

  it('AC6: keeping as active sends no POST', async () => {
    const mock = renderProfile({ 'GET /employees/emp-1': { body: fullView() } })
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as leaver' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep as active' }))
    expect(requestsTo(mock, 'POST /employees/emp-1/leaver')).toHaveLength(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('AC7: an inactive record is shown read-only to HR', async () => {
    renderProfile({
      'GET /employees/emp-1': {
        body: fullView({
          status: 'inactive',
          viewer: { can_edit_work: false, can_edit_personal: false, can_mark_leaver: false },
        }),
      },
    })
    expect(
      await screen.findByText(/Only HR admins can see this record\. It is read-only\./),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit work details' })).not.toBeInTheDocument()
  })

  it('AC10: HR sees the personal details but cannot edit them', async () => {
    renderProfile({ 'GET /employees/emp-1': { body: fullView() } })
    expect(await screen.findByText('+44 7700 900123')).toBeInTheDocument()
    expect(screen.getByText('Tobias Okafor (brother)')).toBeInTheDocument()
    expect(screen.getByText('Edited by the employee')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit contact details' })).not.toBeInTheDocument()
  })
})

describe('employee view', () => {
  const own = () => ({ 'GET /employees/emp-1': { body: fullView({ viewer: OWN_VIEWER }) } })

  it('AC4: the employee edits their phone and sees it', async () => {
    renderProfile({
      ...own(),
      'PATCH /employees/emp-1/personal': {
        body: fullView({
          viewer: OWN_VIEWER,
          personal: { ...fullView().personal, personal_phone: '+44 7700 900999' },
        }),
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Edit contact details' }))
    type('Personal phone', '+44 7700 900999')
    fireEvent.click(screen.getByRole('button', { name: 'Save contact details' }))
    expect(await screen.findByText('+44 7700 900999')).toBeInTheDocument()
    expect(await screen.findByText('Contact details saved.')).toBeInTheDocument()
  })

  it('AC5: work fields are plain text, not editable', async () => {
    renderProfile(own())
    expect(await screen.findByText('Senior accountant')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit work details' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Full name' })).not.toBeInTheDocument()
  })

  it('shows the API error in the drawer and keeps it open', async () => {
    renderProfile({
      ...own(),
      'PATCH /employees/emp-1/personal': { status: 403, body: { detail: 'Not allowed.' } },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Edit contact details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save contact details' }))
    expect(await screen.findByText('Not allowed.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('other viewers and states', () => {
  it('AC9: a manager gets no personal details', async () => {
    renderProfile({ 'GET /employees/emp-1': { body: workView() } })
    expect(
      await screen.findByText(/Not shown\. Only Amara and HR admins can see these\./),
    ).toBeInTheDocument()
    expect(screen.queryByText('+44 7700 900123')).not.toBeInTheDocument()
  })

  it('AC8: a 404 shows the not-available state and no record text', async () => {
    renderProfile({ 'GET /employees/emp-1': { status: 404, body: { detail: 'x' } } })
    expect(await screen.findByRole('heading', { name: "This profile isn't available" })).toBeInTheDocument()
    expect(screen.queryByText('Amara Okafor')).not.toBeInTheDocument()
    expect(screen.queryByText('+44 7700 900123')).not.toBeInTheDocument()
  })

  it('shows a retry when loading fails', async () => {
    renderProfile({ 'GET /employees/emp-1': { status: 500, body: null } })
    expect(await screen.findByText("We couldn't load this profile.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
