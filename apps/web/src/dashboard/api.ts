export type DashboardData = { itemCount: number }

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData> {
  const response = await fetch('/api/dashboard', { signal })
  if (!response.ok) throw new Error(`Dashboard request failed with status ${response.status}`)
  const body: unknown = await response.json()
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as { itemCount?: unknown }).itemCount !== 'number'
  ) {
    throw new Error('Dashboard response has an unexpected shape')
  }
  return { itemCount: (body as DashboardData).itemCount }
}
