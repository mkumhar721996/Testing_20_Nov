import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { HR_VIEWER, OPTIONS, OWN_VIEWER, employeeView, fireUser, mockApi, renderAt } from './testing'

afterEach(() => vi.unstubAllGlobals())

const hrView = () => employeeView({ viewer: HR_VIEWER })

it('shows work and personal details to HR with the read-only personal badge (AC9)', async () => {
  mockApi({ 'GET /employees/e-1': { body: hrView() } })
  renderAt('/employees/e-1')
  expect(await screen.findByRole('heading', { name: 'Amara Okafor' })).toBeInTheDocument()
  expect(screen.getByText('+44 7700 900123')).toBeInTheDocument()
  expect(screen.getByText(/14 Alder Court/)).toBeInTheDocument()
  expect(screen.getByText('Tobias Okafor (brother)')).toBeInTheDocument()
  expect(screen.getByText('+44 7700 900456')).toBeInTheDocument()
  expect(screen.getByText('Edited by the employee')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit contact details' })).not.toBeInTheDocument()
})

it('lets HR change the job title and shows it with a toast (AC3)', async () => {
  const user = fireUser
  const calls = mockApi({
    'GET /employees/e-1': { body: hrView() },
    'GET /employees/options': { body: OPTIONS },
    'PATCH /employees/e-1/work': (body) => ({
      body: employeeView({ viewer: HR_VIEWER, ...(body as object) }),
    }),
  })
  renderAt('/employees/e-1')
  await user.click(await screen.findByRole('button', { name: 'Edit work details' }))
  const job = await screen.findByRole('textbox', { name: 'Job title' })
  await user.clear(job)
  await user.type(job, 'Finance lead')
  await user.click(screen.getByRole('button', { name: 'Save work details' }))
  expect((await screen.findAllByText('Finance lead')).length).toBeGreaterThan(0)
  expect(await screen.findByText('Work details saved.')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  const patch = calls.find((c) => c.method === 'PATCH')
  expect(patch?.body).toMatchObject({ job_title: 'Finance lead', name: 'Amara Okafor', manager_id: 'm-1' })
})

it('blocks saving a blank full name and sends no PATCH (AC3)', async () => {
  const user = fireUser
  const calls = mockApi({
    'GET /employees/e-1': { body: hrView() },
    'GET /employees/options': { body: OPTIONS },
  })
  renderAt('/employees/e-1')
  await user.click(await screen.findByRole('button', { name: 'Edit work details' }))
  await user.clear(await screen.findByRole('textbox', { name: 'Full name' }))
  await user.click(screen.getByRole('button', { name: 'Save work details' }))
  expect(await screen.findByText("Enter the employee's full name.")).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Full name' })).toHaveAttribute('aria-invalid', 'true')
  expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
})

it('lets the employee change their contact details (AC4)', async () => {
  const user = fireUser
  mockApi({
    'GET /employees/e-1': { body: employeeView({ viewer: OWN_VIEWER }) },
    'PATCH /employees/e-1/personal': (body) => ({
      body: employeeView({ viewer: OWN_VIEWER, personal: body as never }),
    }),
  })
  renderAt('/employees/e-1')
  await user.click(await screen.findByRole('button', { name: 'Edit contact details' }))
  const phone = screen.getByRole('textbox', { name: 'Personal phone' })
  await user.clear(phone)
  await user.type(phone, '+44 7700 900999')
  await user.click(screen.getByRole('button', { name: 'Save contact details' }))
  expect(await screen.findByText('+44 7700 900999')).toBeInTheDocument()
  expect(await screen.findByText('Contact details saved.')).toBeInTheDocument()
})

it('does not let the employee edit work fields (AC5)', async () => {
  mockApi({ 'GET /employees/e-1': { body: employeeView({ viewer: OWN_VIEWER }) } })
  renderAt('/employees/e-1')
  expect((await screen.findAllByText('Senior accountant', { exact: false })).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: 'Edit work details' })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Full name' })).not.toBeInTheDocument()
  expect(screen.getByText('Managed by HR')).toBeInTheDocument()
})

it('marks a leaver after confirmation (AC6)', async () => {
  const user = fireUser
  mockApi({
    'GET /employees/e-1': { body: hrView() },
    'POST /employees/e-1/leaver': {
      body: employeeView({
        status: 'inactive',
        viewer: { can_edit_work: false, can_edit_personal: false, can_mark_leaver: false },
      }),
    },
  })
  renderAt('/employees/e-1')
  await user.click(await screen.findByRole('button', { name: 'Mark as leaver' }))
  const dialog = screen.getByRole('dialog', { name: 'Mark Amara Okafor as a leaver?' })
  await user.click(within(dialog).getByRole('button', { name: 'Mark as leaver' }))
  expect(await screen.findByText('Inactive')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit work details' })).not.toBeInTheDocument()
  expect(screen.getByText('Amara Okafor is marked as a leaver.')).toBeInTheDocument()
})

it('sends nothing when HR keeps the employee active', async () => {
  const user = fireUser
  const calls = mockApi({ 'GET /employees/e-1': { body: hrView() } })
  renderAt('/employees/e-1')
  await user.click(await screen.findByRole('button', { name: 'Mark as leaver' }))
  await user.click(screen.getByRole('button', { name: 'Keep as active' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.some((c) => c.method === 'POST')).toBe(false)
})

it('shows HR a read-only leaver record (AC7, AC12)', async () => {
  mockApi({
    'GET /employees/e-1': {
      body: employeeView({
        status: 'inactive',
        viewer: { can_edit_work: false, can_edit_personal: false, can_mark_leaver: false },
      }),
    },
  })
  renderAt('/employees/e-1')
  expect(
    await screen.findByText(/Only HR admins can see this record\. It is read-only\./),
  ).toBeInTheDocument()
  expect(screen.getByText('Inactive')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Mark as leaver' })).not.toBeInTheDocument()
})

it('shows the not-available state without any personal data (AC8)', async () => {
  mockApi({ 'GET /employees/e-1': { status: 404, body: { detail: 'nope' } } })
  renderAt('/employees/e-1')
  expect(await screen.findByRole('heading', { name: "This profile isn't available" })).toBeInTheDocument()
  expect(screen.queryByText('Amara Okafor')).not.toBeInTheDocument()
  expect(screen.queryByText('+44 7700 900123')).not.toBeInTheDocument()
})

it('does not show personal details to someone else (AC11)', async () => {
  mockApi({ 'GET /employees/e-1': { body: employeeView({ withoutPersonal: true }) } })
  renderAt('/employees/e-1')
  expect(
    await screen.findByText(/Not shown\. Only Amara and HR admins can see these\./),
  ).toBeInTheDocument()
  expect(screen.queryByText('+44 7700 900123')).not.toBeInTheDocument()
})

it('offers a retry when loading fails', async () => {
  const user = fireUser
  let attempts = 0
  mockApi({
    'GET /employees/e-1': () => (++attempts === 1 ? { status: 500, body: null } : { body: hrView() }),
  })
  renderAt('/employees/e-1')
  expect(await screen.findByText("We couldn't load this profile.")).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('heading', { name: 'Amara Okafor' })).toBeInTheDocument()
  await waitFor(() => expect(attempts).toBe(2))
})

it('keeps the drawer open with an alert when the server refuses the save', async () => {
  const user = fireUser
  mockApi({
    'GET /employees/e-1': { body: hrView() },
    'GET /employees/options': { body: OPTIONS },
    'PATCH /employees/e-1/work': { status: 403, body: { detail: 'Work details are changed by HR admins on active records.' } },
  })
  renderAt('/employees/e-1')
  await user.click(await screen.findByRole('button', { name: 'Edit work details' }))
  await user.click(await screen.findByRole('button', { name: 'Save work details' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Work details are changed by HR admins')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
