import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { ApiError, getItems, recordMovement } from '../../api/client'
import type { Direction, Item } from '../../api/types'
import { validateMovement } from './validateMovement'
import type { MovementErrors } from './validateMovement'

type Props = { onClose: () => void; onSaved: () => void }

const FOCUSABLE = 'button:not(:disabled), select:not(:disabled), input:not(:disabled)'

export function MovementDrawer({ onClose, onSaved }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [itemsFailed, setItemsFailed] = useState(false)
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [direction, setDirection] = useState<Direction>('in')
  const [errors, setErrors] = useState<MovementErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const drawerRef = useRef<HTMLElement>(null)
  const itemRef = useRef<HTMLSelectElement>(null)
  const quantityRef = useRef<HTMLInputElement>(null)

  const loadItems = useCallback(() => {
    setItemsFailed(false)
    getItems().then(setItems, () => setItemsFailed(true))
  }, [])

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    loadItems()
    itemRef.current?.focus()
    return () => opener?.focus()
  }, [loadItems])

  // Closing mid-save would drop a failure and the entered values.
  function dismiss() {
    if (!saving) onClose()
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape') {
      dismiss()
      return
    }
    if (e.key !== 'Tab' || !drawerRef.current) return
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validateMovement({ itemId, quantity, direction }, items)
    setErrors(found)
    setSaveFailed(false)
    if (found.item || found.quantity) {
      ;(found.item ? itemRef : quantityRef).current?.focus()
      return
    }
    setSaving(true)
    try {
      await recordMovement({ itemId, quantity: Number(quantity), direction })
    } catch (err) {
      setSaving(false)
      if (err instanceof ApiError && err.code === 'insufficient_stock') {
        setErrors({ quantity: `Only ${err.onHand} on hand. Enter ${err.onHand} or fewer.` })
        quantityRef.current?.focus()
      } else {
        setSaveFailed(true)
      }
      return
    }
    onSaved()
    onClose()
  }

  return (
    <>
      <div className="backdrop" onClick={dismiss} />
      <aside
        ref={drawerRef}
        className="drawer"
        id="movement-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onKeyDown={onKeyDown}
      >
        <div className="drawer-head">
          <h2 id="drawer-title">Record movement</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Close record movement"
            onClick={dismiss}
          >
            <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <form className="stack" noValidate onSubmit={onSubmit}>
          {saveFailed && (
            <div className="alert alert-danger" role="alert">
              <div>
                <strong>The movement could not be saved.</strong>
                <span>
                  Check your connection, then try again. Your stock figures have not changed.
                </span>
              </div>
            </div>
          )}
          {itemsFailed && (
            <div className="alert alert-danger">
              <div>
                <strong>The items could not be loaded.</strong>
                <div className="error-actions">
                  <button type="button" className="btn btn-secondary" onClick={loadItems}>
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="field">
            <label className="field-label" htmlFor="mv-item">
              Item
            </label>
            <select
              ref={itemRef}
              className={`select${errors.item ? ' is-invalid' : ''}`}
              id="mv-item"
              value={itemId}
              aria-invalid={errors.item ? true : undefined}
              aria-describedby={errors.item ? 'mv-item-err' : undefined}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">Choose an item</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            {errors.item && (
              <span className="field-error" id="mv-item-err" role="alert">
                {errors.item}
              </span>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="mv-qty">
              Quantity
            </label>
            <input
              ref={quantityRef}
              className={`input${errors.quantity ? ' is-invalid' : ''}`}
              id="mv-qty"
              type="number"
              inputMode="numeric"
              min="1"
              value={quantity}
              aria-invalid={errors.quantity ? true : undefined}
              aria-describedby={`mv-qty-hint${errors.quantity ? ' mv-qty-err' : ''}`}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <span className="field-hint" id="mv-qty-hint">
              Whole units, at least 1.
            </span>
            {errors.quantity && (
              <span className="field-error" id="mv-qty-err" role="alert">
                {errors.quantity}
              </span>
            )}
          </div>
          <fieldset>
            <legend>Direction</legend>
            <label className="choice">
              <input
                className="radio"
                type="radio"
                name="dir"
                value="in"
                checked={direction === 'in'}
                onChange={() => setDirection('in')}
              />
              Goods in
            </label>
            <label className="choice">
              <input
                className="radio"
                type="radio"
                name="dir"
                value="out"
                checked={direction === 'out'}
                onChange={() => setDirection('out')}
              />
              Goods out
            </label>
          </fieldset>
          <div className="drawer-actions">
            <button type="button" className="btn btn-secondary" onClick={dismiss}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save movement'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
