import type { ReactNode } from 'react'

interface FieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  children: (aria: { id: string; 'aria-describedby'?: string; 'aria-invalid': boolean; className: string }) => ReactNode
}

/** A labelled control with its hint and error next to it; the control gets the wiring. */
export default function Field({ id, label, error, hint, children }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ')
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': Boolean(error),
        className: `input${error ? ' is-invalid' : ''}`,
      })}
      {hint && (
        <span className="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  )
}
