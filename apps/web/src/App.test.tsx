import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import App from './App'

it('renders the Dashboard loading state', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  render(<App />)
  expect(screen.getByRole('status')).toBeInTheDocument()
})
