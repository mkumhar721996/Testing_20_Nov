import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import Drawer from './Drawer'

afterEach(cleanup)

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Drawer title="Edit things" closeLabel="Close things" onClose={() => setOpen(false)}>
          <input aria-label="First" />
        </Drawer>
      )}
    </>
  )
}

it('moves focus in, closes on Escape and returns focus to the opener', () => {
  render(<Harness />)
  const opener = screen.getByRole('button', { name: 'Open' })
  opener.focus()
  fireEvent.click(opener)
  expect(screen.getByRole('dialog', { name: 'Edit things' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close things' })).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

it('keeps Tab inside the dialog', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  screen.getByLabelText('First').focus()
  fireEvent.keyDown(document, { key: 'Tab' })
  expect(screen.getByRole('button', { name: 'Close things' })).toHaveFocus()
})
