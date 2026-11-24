import { useCallback, useEffect, useState } from 'react'
import { getDashboard } from '../../api/client'
import type { Dashboard } from '../../api/types'

export type DashboardStatus = 'loading' | 'error' | 'ready'

export function useDashboard() {
  const [data, setData] = useState<Dashboard>()
  const [status, setStatus] = useState<DashboardStatus>('loading')

  const load = useCallback(async (): Promise<boolean> => {
    try {
      setData(await getDashboard())
      setStatus('ready')
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getDashboard().then(
      (d) => {
        if (cancelled) return
        setData(d)
        setStatus('ready')
      },
      () => !cancelled && setStatus('error'),
    )
    return () => {
      cancelled = true
    }
  }, [])

  /** Full retry from the error state: shows the skeleton again. */
  const retry = useCallback(async () => {
    setStatus('loading')
    if (!(await load())) setStatus('error')
  }, [load])

  /** Background refresh: keeps the old figures on screen; resolves false if it failed. */
  const refetch = load

  return { data, status, retry, refetch }
}
