import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./api/client', () => ({
  getDashboard: vi.fn(() => new Promise(() => {})),
  getItems: vi.fn(),
  recordMovement: vi.fn(),
  getEmployee: vi.fn(() => new Promise(() => {})),
  getEmploymentHistory: vi.fn(),
  getJobs: vi.fn(),
  getDepartments: vi.fn(),
  getManagers: vi.fn(),
  saveStructure: vi.fn(),
}))

it('marks Overview as the current page', () => {
  render(<App />)
  // The nav is collapsed behind Menu below 48rem; jsdom has no CSS, so query hidden elements.
  expect(screen.getByRole('link', { name: 'Overview', hidden: true })).toHaveAttribute('aria-current', 'page')
})

it('marks Items as the current page once selected and asks for an employee', async () => {
  render(<App />)
  await userEvent.click(screen.getByRole('link', { name: 'Items', hidden: true }))
  expect(screen.getByRole('link', { name: 'Items', hidden: true })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByText('Choose an employee')).toBeInTheDocument()
})
