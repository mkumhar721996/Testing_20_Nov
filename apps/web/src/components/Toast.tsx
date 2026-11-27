import { useEffect, useRef } from 'react'

const TOAST_MS = 4000

/** Confirmation of a completed action; hides itself after 4 seconds. */
export default function Toast({ message, onHide }: { message: string; onHide: () => void }) {
  const onHideRef = useRef(onHide)
  onHideRef.current = onHide
  useEffect(() => {
    const timer = setTimeout(() => onHideRef.current(), TOAST_MS)
    return () => clearTimeout(timer)
  }, [message])
  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}
