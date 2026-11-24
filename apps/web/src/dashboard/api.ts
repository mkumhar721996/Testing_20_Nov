export interface DashboardSummary {
  itemCount: number
}

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardSummary> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/api'}/dashboard`, {
    signal,
  })
  if (!response.ok) throw new Error(`Dashboard request failed: ${response.status}`)
  const body: { item_count: number } = await response.json()
  return { itemCount: body.item_count }
}
