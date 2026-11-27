import type { Dashboard, Item, NewMovement } from './types'

const BASE = '/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    public onHand?: number,
  ) {
    super(`API ${status}`)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T | undefined> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const body = await res.json().catch(() => undefined)
    const detail = body?.detail
    throw new ApiError(res.status, detail?.code, detail?.on_hand)
  }
  return res.status === 204 ? undefined : ((await res.json()) as T)
}

export async function getDashboard(): Promise<Dashboard> {
  return (await request<Dashboard>('/dashboard'))!
}

export async function getItems(): Promise<Item[]> {
  return (await request<Item[]>('/items'))!
}

export async function recordMovement(m: NewMovement): Promise<void> {
  await request('/stock-movements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: m.itemId, quantity: m.quantity, direction: m.direction }),
  })
}
