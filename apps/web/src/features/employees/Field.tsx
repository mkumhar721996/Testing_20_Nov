import { useId, type ReactNode } from 'react'

type ControlProps = {
  id: string
  className: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

type Props = {
  label: string
  error?: string
  hint?: string
  children: (props: ControlProps) => ReactNode
}

/** A labelled form control with its hint and error message beside it. */
export default function Field({ label, error, hint, children }: Props) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-err`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        className: `input${error ? ' is-invalid' : ''}`,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy || undefined,
      })}
      {hint && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  )
}
