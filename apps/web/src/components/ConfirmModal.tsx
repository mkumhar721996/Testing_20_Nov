import { useId, useRef, type ReactNode } from 'react'
import { useDialog } from './useDialog'

type Props = { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }

/** Short confirmation dialog; the caller supplies the action buttons. */
export default function ConfirmModal({ title, onClose, children, actions }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, onClose)
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div
        ref={ref}
        className="modal is-open"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 className="modal-title" id={titleId}>
          {title}
        </h2>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </>
  )
}
