import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDashboard, type DashboardData } from './api'

export type DashboardState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'ready'; data: DashboardData }

export function useDashboard(load: typeof fetchDashboard = fetchDashboard): {
  state: DashboardState
  retry: () => void
} {
  const [state, setState] = useState<DashboardState>({ status: 'loading' })
  const attempt = useRef(0)
  const controller = useRef<AbortController | null>(null)

  const run = useCallback(() => {
    controller.current?.abort()
    const current = ++attempt.current
    const abort = new AbortController()
    controller.current = abort
    load(abort.signal).then(
      (data) => {
        if (current !== attempt.current) return
        setState(data.itemCount === 0 ? { status: 'empty' } : { status: 'ready', data })
      },
      () => {
        if (current === attempt.current) setState({ status: 'error' })
      },
    )
  }, [load])

  useEffect(() => {
    run()
    return () => {
      attempt.current++
      controller.current?.abort()
    }
  }, [run])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    run()
  }, [run])

  return { state, retry }
}
