import { useId, useRef, type ReactNode } from 'react'
import Icon from './Icon'
import { useDialog } from './useDialog'

type Props = { title: string; onClose: () => void; children: ReactNode }

/** Side panel for editing a record. */
export default function Drawer({ title, onClose, children }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)
  useDialog(ref, onClose)
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside
        ref={ref}
        className="drawer is-open"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="drawer-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} aria-label={`Close ${title}`}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </aside>
    </>
  )
}
