import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { expect, it } from 'vitest'
import ConfirmModal from './ConfirmModal'
import Drawer from './Drawer'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      {open && (
        <Drawer title="Edit things" onClose={() => setOpen(false)}>
          <input aria-label="First" />
          <button>Last</button>
        </Drawer>
      )}
    </>
  )
}

it('moves focus in, closes on Escape and returns focus to the opener', () => {
  render(<Harness />)
  const opener = screen.getByRole('button', { name: 'Open it' })
  opener.focus()
  fireEvent.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Edit things' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toContainElement(document.activeElement as HTMLElement)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

it('closes on backdrop click', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Open it' }))
  fireEvent.click(document.querySelector('.backdrop')!)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('traps Tab inside the drawer', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Open it' }))
  screen.getByRole('button', { name: 'Last' }).focus()
  fireEvent.keyDown(document, { key: 'Tab' })
  expect(screen.getByRole('button', { name: 'Close Edit things' })).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
  expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
})

it('confirm modal closes on Escape', () => {
  let closed = false
  render(
    <ConfirmModal title="Sure?" onClose={() => (closed = true)}>
      <p>Body</p>
    </ConfirmModal>,
  )
  expect(screen.getByRole('dialog', { name: 'Sure?' })).toBeInTheDocument()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(closed).toBe(true)
})
