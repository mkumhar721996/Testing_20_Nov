import type { Direction, Item } from '../../api/types'

export type MovementDraft = { itemId: string; quantity: string; direction: Direction }
export type MovementErrors = { item?: string; quantity?: string }

export function validateMovement(d: MovementDraft, items: Item[]): MovementErrors {
  const errors: MovementErrors = {}
  if (!d.itemId) errors.item = 'Choose the item that moved.'

  const quantity = Number(d.quantity)
  if (d.quantity.trim() === '' || !Number.isInteger(quantity) || quantity < 1) {
    errors.quantity = 'Enter a quantity of 1 or more, like 24.'
  } else if (d.direction === 'out') {
    const item = items.find((i) => i.id === d.itemId)
    if (item && quantity > item.on_hand) {
      errors.quantity = `Only ${item.on_hand} on hand. Enter ${item.on_hand} or fewer.`
    }
  }
  return errors
}
