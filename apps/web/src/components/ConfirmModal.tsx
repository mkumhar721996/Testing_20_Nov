import { useId, useRef, type ReactNode } from 'react'
import { useDialog } from './useDialog'

interface ConfirmModalProps {
  title: string
  confirmLabel: string
  cancelLabel: string
  pending?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
  children: ReactNode
}

export default function ConfirmModal({
  title,
  confirmLabel,
  cancelLabel,
  pending = false,
  error,
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDialog(ref, onCancel)

  return (
    <>
      <div className="backdrop" onClick={onCancel} />
      <div ref={ref} className="modal is-open" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 className="modal-title" id={titleId}>
          {title}
        </h2>
        <p>{children}</p>
        {error && (
          <div className="alert alert-danger" role="alert">
            <span>{error}</span>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-danger" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
