import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { getEmployee, getMyEmployee, type EmployeeView } from '../../api/employees'

export type EmployeeState =
  | { kind: 'loading' }
  | { kind: 'not-available' }
  | { kind: 'error' }
  | { kind: 'ready'; employee: EmployeeView }

/** Loads one profile; `id` of "me" loads the signed-in employee's own. */
export function useEmployee(id: string) {
  const [state, setState] = useState<EmployeeState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    const request = id === 'me' ? getMyEmployee() : getEmployee(id)
    request
      .then((employee) => !cancelled && setState({ kind: 'ready', employee }))
      .catch((err: unknown) => {
        if (cancelled) return
        setState(err instanceof ApiError && err.status === 404 ? { kind: 'not-available' } : { kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const replace = useCallback((employee: EmployeeView) => setState({ kind: 'ready', employee }), [])
  return { state, reload, replace }
}
