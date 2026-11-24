import { afterEach, expect, it, vi } from 'vitest'
import { fetchDashboard } from './api'

afterEach(() => vi.unstubAllGlobals())

it('rejects on a non-2xx response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
  await expect(fetchDashboard()).rejects.toThrow()
})

it('maps item_count to itemCount', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ item_count: 4 }) }),
  )
  await expect(fetchDashboard()).resolves.toEqual({ itemCount: 4 })
})
