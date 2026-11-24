import { useId, useRef, type ReactNode } from 'react'
import { useDialog } from './useDialog'

interface DrawerProps {
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
}

export default function Drawer({ title, closeLabel, onClose, children }: DrawerProps) {
  const ref = useRef<HTMLElement>(null)
  const titleId = useId()
  useDialog(ref, onClose)

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside ref={ref} className="drawer is-open" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="drawer-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-icon btn-ghost" aria-label={closeLabel} onClick={onClose}>
            <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        {children}
      </aside>
    </>
  )
}
