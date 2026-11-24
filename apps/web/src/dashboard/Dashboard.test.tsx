import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

const noop = () => {}
const overview = { name: 'Warehouse overview' }

it('replaces all content with a loading state while loading', () => {
  const load = vi.fn(() => new Promise<never>(() => {}))
  render(<Dashboard onAddFirstItem={noop} load={load} />)
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByText('Loading warehouse overview…')).toBeInTheDocument()
  expect(screen.queryByRole('heading', overview)).not.toBeInTheDocument()
})

it('replaces all content with an empty state when there is no data', async () => {
  render(<Dashboard onAddFirstItem={noop} load={() => Promise.resolve({ itemCount: 0 })} />)
  expect(await screen.findByRole('heading', { name: 'No stock recorded yet' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', overview)).not.toBeInTheDocument()
})

it('shows an Add first item button in the empty state', async () => {
  const onAdd = vi.fn()
  render(<Dashboard onAddFirstItem={onAdd} load={() => Promise.resolve({ itemCount: 0 })} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Add first item' }))
  expect(onAdd).toHaveBeenCalledTimes(1)
})

it('replaces all content with an error state when loading fails', async () => {
  render(<Dashboard onAddFirstItem={noop} load={() => Promise.reject(new Error('boom'))} />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The warehouse overview could not be loaded.',
  )
  expect(screen.queryByRole('heading', overview)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

it('shows the normal view when Try again succeeds', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ itemCount: 3 })
  render(<Dashboard onAddFirstItem={noop} load={load} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('heading', overview)).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(load).toHaveBeenCalledTimes(2)
})

it('shows the error state again when Try again fails', async () => {
  const load = vi.fn().mockRejectedValue(new Error('x'))
  render(<Dashboard onAddFirstItem={noop} load={load} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(load).toHaveBeenCalledTimes(2)
})
