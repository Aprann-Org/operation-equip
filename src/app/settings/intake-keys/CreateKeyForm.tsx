'use client'

import { useActionState, useState } from 'react'
import { createIntakeKey, type CreateKeyState } from './actions'

export function CreateKeyForm() {
  const [state, formAction, isPending] = useActionState<CreateKeyState, FormData>(
    createIntakeKey,
    { error: null, key: null, label: null }
  )
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(key: string) {
    try {
      await navigator.clipboard.writeText(key)
      setCopied(key)
    } catch {
      // Clipboard can be blocked; the key is still selectable on screen.
    }
  }

  return (
    <div>
      {state.key && (
        <div
          className="card"
          style={{ marginBottom: '1rem', borderColor: '#16a34a', background: '#f0fdf4' }}
          aria-live="polite"
        >
          <div className="card-body">
            <p style={{ fontWeight: 600, marginBottom: 6 }}>
              Key created for “{state.label}”. Copy it now — it will not be shown again.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  padding: '6px 8px',
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  wordBreak: 'break-all',
                  userSelect: 'all',
                }}
              >
                {state.key}
              </code>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(state.key!)}>
                {copied === state.key ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <form action={formAction}>
        {state.error && <p className="form-error">{state.error}</p>}
        <div className="field">
          <label className="label" htmlFor="intake-key-label">Label *</label>
          <input
            id="intake-key-label"
            name="label"
            required
            maxLength={100}
            className="input"
            placeholder="e.g. Bench USB stick, Saturday volunteer laptop"
          />
          <p className="field-hint">So you can tell keys apart when it is time to revoke one.</p>
        </div>
        <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
          {isPending ? 'Creating…' : 'Create Key'}
        </button>
      </form>
    </div>
  )
}
