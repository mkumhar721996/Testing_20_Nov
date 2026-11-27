import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import App from './App'

it('renders the heading', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: 'Web App' })).toBeInTheDocument()
})
