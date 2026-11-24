import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import AppShell from './AppShell'

afterEach(cleanup)

it('marks Items as the current page and keeps Account apart', () => {
  render(
    <AppShell>
      <p>content</p>
    </AppShell>,
  )
  expect(screen.getByRole('link', { name: 'Items', hidden: true })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('data-nav-key', 'account')
  expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
})
