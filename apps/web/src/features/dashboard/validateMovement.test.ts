import { expect, it } from 'vitest'
import { validateMovement } from './validateMovement'

const items = [{ id: 'a', name: 'Item A', bin: 'A-01', on_hand: 3 }]

it('requires an item', () => {
  expect(validateMovement({ itemId: '', quantity: '5', direction: 'in' }, items).item).toBe(
    'Choose the item that moved.',
  )
})

it('rejects zero, negative, empty and fractional quantities', () => {
  for (const q of ['0', '-3', '', '1.5']) {
    expect(validateMovement({ itemId: 'a', quantity: q, direction: 'in' }, items).quantity).toBe(
      'Enter a quantity of 1 or more, like 24.',
    )
  }
})

it('rejects an outgoing quantity above on hand', () => {
  expect(validateMovement({ itemId: 'a', quantity: '5', direction: 'out' }, items).quantity).toBe(
    'Only 3 on hand. Enter 3 or fewer.',
  )
})

it('accepts incoming above on hand and valid outgoing', () => {
  expect(validateMovement({ itemId: 'a', quantity: '5', direction: 'in' }, items)).toEqual({})
  expect(validateMovement({ itemId: 'a', quantity: '3', direction: 'out' }, items)).toEqual({})
})
