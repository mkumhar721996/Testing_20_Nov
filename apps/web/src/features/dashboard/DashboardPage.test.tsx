import { render, screen, waitFor } from '@testing-library/react'
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
