import { afterEach, expect, it, vi } from 'vitest'
import { fetchDashboard } from './api'

afterEach(() => vi.unstubAllGlobals())

const stub = (response: Response) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

it('rejects on a malformed body', async () => {
  stub(new Response('{}', { status: 200 }))
  await expect(fetchDashboard()).rejects.toThrow()
})

it('rejects on a non-2xx status', async () => {
  stub(new Response('', { status: 503 }))
  await expect(fetchDashboard()).rejects.toThrow()
})

it('rejects on a network error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
  await expect(fetchDashboard()).rejects.toThrow()
})

it('resolves on a valid body', async () => {
  stub(new Response('{"itemCount":2}', { status: 200 }))
  await expect(fetchDashboard()).resolves.toEqual({ itemCount: 2 })
})
