import { useCallback, useEffect, useState } from 'react'
import {
  type AttendanceRecord,
  RefusedError,
  type RefusalCode,
  clockIn as apiClockIn,
  clockOut as apiClockOut,
  listRecords,
} from './api'

export type Action = 'clock-in' | 'clock-out'
export type Notice = { action: Action; at: string }

export function useAttendance() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [refusal, setRefusal] = useState<RefusalCode | null>(null)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const reload = useCallback(async () => {
    try {
      setRecords(await listRecords())
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const run = useCallback(
    async (action: Action) => {
      setPending(true)
      setRefusal(null)
      setNotice(null)
      try {
        await (action === 'clock-in' ? apiClockIn() : apiClockOut())
        setNotice({ action, at: new Date().toISOString() })
      } catch (e) {
        if (e instanceof RefusedError) setRefusal(e.code)
        else setStatus('error')
      }
      // Always re-read so the screen reflects what the server holds.
      await reload()
      setPending(false)
    },
    [reload],
  )

  return {
    status,
    records,
    clockedIn: records[0]?.clockOutAt === null,
    refusal,
    pending,
    notice,
    clockIn: () => run('clock-in'),
    clockOut: () => run('clock-out'),
    reload: () => {
      setStatus('loading')
      return reload()
    },
  }
}
