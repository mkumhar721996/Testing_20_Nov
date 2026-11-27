import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

const overview = { name: 'Warehouse overview' }

it('shows only the loading state while loading (AC1)', () => {
  render(<Dashboard load={() => new Promise(() => {})} />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading warehouse overview…')
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(screen.queryByRole('heading', overview)).not.toBeInTheDocument()
})

it('shows the empty state with an Add first item button (AC2, AC3)', async () => {
  const onAddFirstItem = vi.fn()
  render(<Dashboard load={async () => ({ itemCount: 0 })} onAddFirstItem={onAddFirstItem} />)
  expect(await screen.findByRole('heading', { name: 'No stock recorded yet' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', overview)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add first item' }))
  expect(onAddFirstItem).toHaveBeenCalledTimes(1)
})

it('shows the error state with a Try again button (AC4, AC5)', async () => {
  render(
    <Dashboard
      load={async () => {
        throw new Error('boom')
      }}
    />,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('The warehouse overview could not be loaded.')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', overview)).not.toBeInTheDocument()
})

it('shows the normal view after Try again succeeds (AC6)', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ itemCount: 3 })
  render(<Dashboard load={load} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('heading', overview)).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(load).toHaveBeenCalledTimes(2)
})

it('shows the error again when Try again fails (AC7)', async () => {
  const load = vi.fn().mockRejectedValue(new Error('x'))
  render(<Dashboard load={load} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(load).toHaveBeenCalledTimes(2)
})
