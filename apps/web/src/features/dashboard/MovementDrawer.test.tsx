import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError, getItems, recordMovement } from '../../api/client'
import { MovementDrawer } from './MovementDrawer'

vi.mock('../../api/client', async (orig) => ({
  ...(await orig<typeof import('../../api/client')>()),
  getItems: vi.fn(),
  recordMovement: vi.fn(),
}))

const items = [
  { id: 'item-a-id', name: 'Item A', bin: 'A-01', on_hand: 3 },
  { id: 'item-b-id', name: 'Item B', bin: 'B-01', on_hand: 50 },
]
const onClose = vi.fn()
const onSaved = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getItems).mockResolvedValue(items)
  vi.mocked(recordMovement).mockResolvedValue()
})

async function open() {
  const user = userEvent.setup()
  render(<MovementDrawer onClose={onClose} onSaved={onSaved} />)
  await screen.findByRole('option', { name: 'Item A' })
  return user
}

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Save movement' }))

it('shows item, quantity and direction (AC 2)', async () => {
  await open()
  expect(screen.getByLabelText('Item')).toBeInTheDocument()
  expect(screen.getByLabelText('Quantity')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Goods in' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Goods out' })).not.toBeChecked()
})

it('records exactly the entered values (AC 3)', async () => {
  const user = await open()
  await user.selectOptions(screen.getByLabelText('Item'), 'item-a-id')
  await user.type(screen.getByLabelText('Quantity'), '5')
  await save(user)
  expect(recordMovement).toHaveBeenCalledWith({ itemId: 'item-a-id', quantity: 5, direction: 'in' })
  expect(onSaved).toHaveBeenCalled()
  expect(onClose).toHaveBeenCalled()
})

it('blocks a save with no item and shows the error beside the field (AC 6, 9)', async () => {
  const user = await open()
  await user.type(screen.getByLabelText('Quantity'), '5')
  await save(user)
  expect(recordMovement).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Item')).toHaveAccessibleDescription(/Choose the item that moved\./)
  expect(screen.getByLabelText('Item')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Quantity')).toHaveValue(5)
})

it('blocks zero and negative quantities and keeps the values (AC 7, 9)', async () => {
  const user = await open()
  await user.click(screen.getByRole('radio', { name: 'Goods out' }))
  await user.selectOptions(screen.getByLabelText('Item'), 'item-b-id')
  for (const q of ['0', '-3']) {
    await user.clear(screen.getByLabelText('Quantity'))
    await user.type(screen.getByLabelText('Quantity'), q)
    await save(user)
    expect(recordMovement).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Quantity')).toHaveAccessibleDescription(
      /Enter a quantity of 1 or more, like 24\./,
    )
    expect(screen.getByLabelText('Quantity')).toHaveValue(Number(q))
  }
  expect(screen.getByRole('radio', { name: 'Goods out' })).toBeChecked()
  expect(screen.getByLabelText('Item')).toHaveValue('item-b-id')
})

it('blocks an outgoing quantity above on hand (AC 8)', async () => {
  const user = await open()
  await user.click(screen.getByRole('radio', { name: 'Goods out' }))
  await user.selectOptions(screen.getByLabelText('Item'), 'item-a-id')
  await user.type(screen.getByLabelText('Quantity'), '5')
  await save(user)
  expect(recordMovement).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Quantity')).toHaveAccessibleDescription(
    /Only 3 on hand\. Enter 3 or fewer\./,
  )
})

it('maps a server 409 to the inline quantity error and stays open (AC 8)', async () => {
  vi.mocked(recordMovement).mockRejectedValueOnce(new ApiError(409, 'insufficient_stock', 3))
  const user = await open()
  await user.click(screen.getByRole('radio', { name: 'Goods out' }))
  await user.selectOptions(screen.getByLabelText('Item'), 'item-b-id')
  await user.type(screen.getByLabelText('Quantity'), '5')
  await save(user)
  expect(await screen.findByText('Only 3 on hand. Enter 3 or fewer.')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

it('keeps the drawer and values and shows an alert when the save fails (AC 10, 11)', async () => {
  vi.mocked(recordMovement).mockRejectedValueOnce(new ApiError(500))
  const user = await open()
  await user.click(screen.getByRole('radio', { name: 'Goods out' }))
  await user.selectOptions(screen.getByLabelText('Item'), 'item-b-id')
  await user.type(screen.getByLabelText('Quantity'), '5')
  await save(user)
  const alert = await within(screen.getByRole('dialog')).findByRole('alert')
  expect(alert).toHaveTextContent('The movement could not be saved.')
  expect(screen.getByLabelText('Quantity')).toHaveValue(5)
  expect(screen.getByLabelText('Item')).toHaveValue('item-b-id')
  expect(screen.getByRole('radio', { name: 'Goods out' })).toBeChecked()
  expect(screen.getByRole('button', { name: 'Save movement' })).toBeEnabled()
  expect(onClose).not.toHaveBeenCalled()
})

it('closes on Escape', async () => {
  const user = await open()
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
})

it('offers to retry when items fail to load', async () => {
  vi.mocked(getItems).mockRejectedValueOnce(new Error('down'))
  const user = userEvent.setup()
  render(<MovementDrawer onClose={onClose} onSaved={onSaved} />)
  await user.click(await screen.findByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('option', { name: 'Item A' })).toBeInTheDocument()
})
