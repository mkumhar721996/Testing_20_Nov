import { getAccessToken } from '../auth/token'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`)
    this.status = status
    this.body = body
  }
}

export async function apiRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await response.text()
  const body: unknown = text ? JSON.parse(text) : null
  if (!response.ok) throw new ApiError(response.status, body)
  return body as T
}
