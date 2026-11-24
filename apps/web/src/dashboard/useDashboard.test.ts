import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useDashboard } from './useDashboard'

it('goes loading then empty for no items', async () => {
  const { result } = renderHook(() => useDashboard(() => Promise.resolve({ itemCount: 0 })))
  expect(result.current.status).toBe('loading')
  await waitFor(() => expect(result.current.status).toBe('empty'))
})

it('goes loading then ready for items', async () => {
  const { result } = renderHook(() => useDashboard(() => Promise.resolve({ itemCount: 2 })))
  expect(result.current.status).toBe('loading')
  await waitFor(() => expect(result.current.status).toBe('ready'))
})

it('returns to loading on retry', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ itemCount: 2 })
  const { result } = renderHook(() => useDashboard(load))
  await waitFor(() => expect(result.current.status).toBe('error'))
  act(() => result.current.retry())
  expect(result.current.status).toBe('loading')
  await waitFor(() => expect(result.current.status).toBe('ready'))
})

it('ignores a stale response after a newer request started', async () => {
  let resolveStale: (v: { itemCount: number }) => void = () => {}
  const load = vi
    .fn()
    .mockReturnValueOnce(new Promise((r) => (resolveStale = r)))
    .mockResolvedValueOnce({ itemCount: 5 })
  const { result } = renderHook(() => useDashboard(load))
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.status).toBe('ready'))
  await act(async () => resolveStale({ itemCount: 0 }))
  expect(result.current.status).toBe('ready')
})
