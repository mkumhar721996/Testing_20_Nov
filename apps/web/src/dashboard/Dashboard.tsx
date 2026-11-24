import { fetchDashboard } from './api'
import DashboardEmpty from './DashboardEmpty'
import DashboardError from './DashboardError'
import DashboardLoading from './DashboardLoading'
import DashboardView from './DashboardView'
import { useDashboard } from './useDashboard'

export default function Dashboard({
  onAddFirstItem,
  load = fetchDashboard,
}: {
  onAddFirstItem: () => void
  load?: typeof fetchDashboard
}) {
  const dashboard = useDashboard(load)
  switch (dashboard.status) {
    case 'loading':
      return <DashboardLoading />
    case 'empty':
      return <DashboardEmpty onAddFirstItem={onAddFirstItem} />
    case 'error':
      return <DashboardError onRetry={dashboard.retry} />
    case 'ready':
      return <DashboardView />
  }
}
