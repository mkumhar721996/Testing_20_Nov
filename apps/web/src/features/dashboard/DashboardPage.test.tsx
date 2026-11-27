import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getDashboard, getItems, recordMovement } from '../../api/client'
import type { Dashboard } from '../../api/types'
import { DashboardPage } from './DashboardPage'

vi.mock('../../api/client', async (orig) => ({
  ...(await orig<typeof import('../../api/client')>()),
  getDashboard: vi.fn(),
  getItems: vi.fn(),
  recordMovement: vi.fn(),
}))

const dashboard = (stock: number, count = 1): Dashboard => ({
  items_in_stock: stock,
  movements_today: 42,
  item_count: count,
  recent_movements: [],
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getDashboard).mockResolvedValue(dashboard(1284))
  vi.mocked(getItems).mockResolvedValue([{ id: 'item-a-id', name: 'Item A', bin: 'A-01', on_hand: 3 }])
  vi.mocked(recordMovement).mockResolvedValue()
})

async function openDrawer() {
  const user = userEvent.setup()
  render(<DashboardPage />)
  await user.click(await screen.findByRole('button', { name: /record movement/i }))
  return user
}

it('keeps the Dashboard as the page while the drawer is open (AC 1)', async () => {
  await openDrawer()
  expect(screen.getByRole('dialog', { name: 'Record movement' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Warehouse overview' })).toBeInTheDocument()
})

it('refreshes the figures, closes the drawer and toasts after a save (AC 4, 5)', async () => {
  const user = await openDrawer()
  expect(await screen.findByText('1,284')).toBeInTheDocument()
  vi.mocked(getDashboard).mockResolvedValue(dashboard(1289))
  await user.selectOptions(await screen.findByLabelText('Item'), 'item-a-id')
  await user.type(screen.getByLabelText('Quantity'), '5')
  await user.click(screen.getByRole('button', { name: 'Save movement' }))
  expect(await screen.findByText('1,289')).toBeInTheDocument()
  expect(getDashboard).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('status')).toHaveTextContent('Movement saved. Figures updated.')
})

it('shows a loading status first', () => {
  vi.mocked(getDashboard).mockReturnValue(new Promise(() => {}))
  render(<DashboardPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading warehouse overview…')
})

it('shows an error and retries', async () => {
  vi.mocked(getDashboard).mockRejectedValueOnce(new Error('down'))
  const user = userEvent.setup()
  render(<DashboardPage />)
  expect(await screen.findByText('The warehouse overview could not be loaded.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('heading', { name: 'Warehouse overview' })).toBeInTheDocument()
})

it('shows the empty state when there are no items', async () => {
  vi.mocked(getDashboard).mockResolvedValue(dashboard(0, 0))
  render(<DashboardPage />)
  expect(await screen.findByText('No stock recorded yet')).toBeInTheDocument()
})

const SOON_LABELS = ['FD', 'PF', 'NPS', 'Transfer money', 'Pay a bill', 'Deposit a cheque']
const soonButton = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) })

async function renderLoaded() {
  render(<DashboardPage />)
  await screen.findByRole('heading', { name: 'Warehouse overview' })
}

it('shows the logo and avatar in the header (AC 1)', async () => {
  await renderLoaded()
  expect(screen.getByText('Banking')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /signed in as/i })).toBeInTheDocument()
})

it('shows FD, PF and NPS in the navigation (AC 2)', async () => {
  await renderLoaded()
  const nav = screen.getByRole('navigation', { name: 'Banking products' })
  for (const n of ['FD', 'PF', 'NPS']) {
    expect(within(nav).getByRole('button', { name: new RegExp(`^${n}`) })).toBeInTheDocument()
  }
})

it('shows the three quick actions (AC 3)', async () => {
  await renderLoaded()
  const group = screen.getByRole('group', { name: 'Quick actions' })
  for (const a of ['Transfer money', 'Pay a bill', 'Deposit a cheque']) {
    expect(within(group).getByRole('button', { name: new RegExp(a) })).toBeInTheDocument()
  }
})

it('marks every destination coming soon (AC 4)', async () => {
  await renderLoaded()
  for (const label of SOON_LABELS) {
    expect(soonButton(label)).toHaveTextContent(/coming soon/i)
  }
})

it('stays on the Dashboard and changes no data when a destination is activated (AC 5, 6)', async () => {
  await renderLoaded()
  for (const label of SOON_LABELS) {
    const button = soonButton(label)
    expect(button).toBeDisabled()
    fireEvent.click(button)
  }
  expect(screen.getByRole('heading', { name: 'Warehouse overview' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(recordMovement).not.toHaveBeenCalled()
  expect(getDashboard).toHaveBeenCalledTimes(1)
})

it('shows quick actions only when the dashboard has items', async () => {
  vi.mocked(getDashboard).mockResolvedValue(dashboard(0, 0))
  render(<DashboardPage />)
  await screen.findByText('No stock recorded yet')
  expect(screen.queryByRole('group', { name: 'Quick actions' })).not.toBeInTheDocument()
})
