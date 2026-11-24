import { useEffect, useRef } from 'react'

const AUTO_HIDE_MS = 4000

export default function Toast({ message, onHide }: { message: string; onHide: () => void }) {
  const hideRef = useRef(onHide)
  hideRef.current = onHide

  useEffect(() => {
    const timer = setTimeout(() => hideRef.current(), AUTO_HIDE_MS)
    return () => clearTimeout(timer)
  }, [message])

  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}
