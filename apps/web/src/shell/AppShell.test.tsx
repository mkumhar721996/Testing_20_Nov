import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import AppShell from './AppShell'

const renderShell = () =>
  render(
    <MemoryRouter>
      <AppShell section="items">
        <h1>Inside</h1>
      </AppShell>
    </MemoryRouter>,
  )

it('marks Items as the current page on an employee screen', () => {
  renderShell()
  expect(screen.getByRole('link', { name: 'Items' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Reports' })).not.toHaveAttribute('aria-current')
})

it('shows the four sections in order with Account apart', () => {
  renderShell()
  const keys = Array.from(document.querySelectorAll('[data-nav-key]')).map((n) =>
    n.getAttribute('data-nav-key'),
  )
  expect(keys).toEqual(['overview', 'items', 'reports', 'settings', 'account'])
})

it('puts page content in the main landmark', () => {
  renderShell()
  expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Inside' }))
})

it('toggles the menu on small screens', () => {
  renderShell()
  const button = screen.getByRole('button', { name: 'Menu' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
})
