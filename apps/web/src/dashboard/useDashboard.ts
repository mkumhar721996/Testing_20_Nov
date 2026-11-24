import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDashboard, type DashboardSummary } from './api'

export type DashboardState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'ready'; summary: DashboardSummary }

export function useDashboard(load = fetchDashboard): DashboardState & { retry: () => void } {
  const [state, setState] = useState<DashboardState>({ status: 'loading' })
  const controller = useRef<AbortController | null>(null)
  // Latest loader, so an inline `load` does not re-trigger the request every render.
  const loadRef = useRef(load)
  loadRef.current = load

  const request = useCallback(() => {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setState({ status: 'loading' })
    loadRef.current(current.signal).then(
      (summary) => {
        if (current.signal.aborted) return
        setState(summary.itemCount === 0 ? { status: 'empty' } : { status: 'ready', summary })
      },
      () => {
        if (current.signal.aborted) return
        setState({ status: 'error' })
      },
    )
  }, [])

  useEffect(() => {
    request()
    return () => controller.current?.abort()
  }, [request])

  return { ...state, retry: request }
}
