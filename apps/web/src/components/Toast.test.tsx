import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Toast from './Toast'

afterEach(() => vi.useRealTimers())

it('announces the message and hides after 4 seconds', () => {
  vi.useFakeTimers()
  let hidden = false
  render(<Toast message="Work details saved." onHide={() => (hidden = true)} />)
  expect(screen.getByRole('status')).toHaveTextContent('Work details saved.')
  act(() => vi.advanceTimersByTime(3999))
  expect(hidden).toBe(false)
  act(() => vi.advanceTimersByTime(1))
  expect(hidden).toBe(true)
})
