import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./api/client', () => ({
  getDashboard: vi.fn(() => new Promise(() => {})),
  getItems: vi.fn(),
  recordMovement: vi.fn(),
}))

it('marks Overview as the current page', () => {
  render(<App />)
  // The nav is collapsed behind Menu below 48rem; jsdom has no CSS, so query hidden elements.
  expect(screen.getByRole('link', { name: 'Overview', hidden: true })).toHaveAttribute('aria-current', 'page')
})
