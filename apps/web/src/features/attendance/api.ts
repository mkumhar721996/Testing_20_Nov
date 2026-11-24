import { getAccessToken } from '../../auth/getAccessToken'

export type AttendanceRecord = {
  id: string
  date: string
  clockInAt: string
  clockOutAt: string | null
}

export type RefusalCode = 'already_clocked_in' | 'not_clocked_in' | 'other_employee'

export class RefusedError extends Error {
  code: RefusalCode
  constructor(code: RefusalCode) {
    super(code)
    this.code = code
  }
}

// Same-origin when VITE_API_BASE_URL is unset.
const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

type ApiRecord = {
  id: string
  date: string
  clock_in_at: string
  clock_out_at: string | null
}

function toRecord(r: ApiRecord): AttendanceRecord {
  return { id: r.id, date: r.date, clockInAt: r.clock_in_at, clockOutAt: r.clock_out_at }
}

async function request(path: string, method: 'GET' | 'POST'): Promise<Response> {
  const token = getAccessToken()
  return fetch(`${baseUrl}/attendance/${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

export async function listRecords(): Promise<AttendanceRecord[]> {
  const res = await request('records', 'GET')
  if (!res.ok) throw new Error(`Listing records failed (${res.status})`)
  return ((await res.json()) as ApiRecord[]).map(toRecord)
}

async function act(path: 'clock-in' | 'clock-out'): Promise<void> {
  const res = await request(path, 'POST')
  if (res.ok) return
  if (res.status === 403 || res.status === 409) {
    const body = (await res.json().catch(() => null)) as { detail?: { code?: RefusalCode } } | null
    if (body?.detail?.code) throw new RefusedError(body.detail.code)
  }
  throw new Error(`Request failed (${res.status})`)
}

export const clockIn = () => act('clock-in')
export const clockOut = () => act('clock-out')
