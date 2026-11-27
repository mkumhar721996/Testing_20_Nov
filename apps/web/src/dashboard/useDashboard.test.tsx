import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { DashboardData } from './api'
import { useDashboard } from './useDashboard'

function deferred() {
  let resolve!: (d: DashboardData) => void
  const promise = new Promise<DashboardData>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

it('ignores a stale response after a retry', async () => {
  const first = deferred()
  const second = deferred()
  const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const { result } = renderHook(() => useDashboard(load))
  act(() => result.current.retry())
  await act(async () => second.resolve({ itemCount: 5 }))
  await act(async () => first.resolve({ itemCount: 0 }))
  await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: { itemCount: 5 } }))
})

it('does not update state after unmount', async () => {
  const pending = deferred()
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { result, unmount } = renderHook(() => useDashboard(() => pending.promise))
  unmount()
  await act(async () => pending.resolve({ itemCount: 1 }))
  expect(result.current.state).toEqual({ status: 'loading' })
  expect(error).not.toHaveBeenCalled()
})
