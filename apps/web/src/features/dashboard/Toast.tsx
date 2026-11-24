import { useEffect } from 'react'

const HIDE_AFTER_MS = 4000

export function Toast({ message, onHide }: { message: string; onHide: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onHide, HIDE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [message, onHide])

  return (
    <div className="toast" role="status">
      <span>{message}</span>
    </div>
  )
}
