import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { requestsTo, stubFetch, workView } from './testing/fetchStub'
import App from './App'

afterEach(() => vi.unstubAllGlobals())

it('opens the signed-in employee profile from the root', async () => {
  const mock = stubFetch({
    'GET /employees/me': { body: workView() },
    'GET /employees/emp-1': { body: workView() },
  })
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
  // "me" redirects to the profile's own URL, which loads it again.
  await waitFor(() => expect(requestsTo(mock, 'GET /employees/emp-1')).toHaveLength(1))
  expect(await screen.findByRole('heading', { name: 'Amara Okafor' })).toBeInTheDocument()
})
