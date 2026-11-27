import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { getEmployee, getMyEmployee, type EmployeeView } from '../../api/employees'

export type EmployeeState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error' }
  | { status: 'ready'; employee: EmployeeView }

/** Loads one profile; `id` of "me" loads the caller's own. The server decides what is in it. */
export function useEmployee(id: string) {
  const [state, setState] = useState<EmployeeState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    ;(id === 'me' ? getMyEmployee() : getEmployee(id)).then(
      (employee) => !cancelled && setState({ status: 'ready', employee }),
      (error: unknown) => {
        if (cancelled) return
        const missing = error instanceof ApiError && error.status === 404
        setState({ status: missing ? 'unavailable' : 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const setEmployee = useCallback((employee: EmployeeView) => setState({ status: 'ready', employee }), [])
  return { state, reload, setEmployee }
}
