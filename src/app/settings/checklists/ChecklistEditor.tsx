'use client'

import { useActionState } from 'react'
import { addChecklistItem, deleteChecklistItem } from './actions'
import styles from './ChecklistEditor.module.css'

type Item = {
  id: string
  order: number
  label: string
  result_type: string
  required: boolean
  help_text: string | null
}

export function ChecklistEditor({ templateId, items }: { templateId: string; items: Item[] }) {
  const [addState, addAction, addPending] = useActionState(addChecklistItem, { error: null })

  return (
    <div className={styles.editor}>
      <div className={styles.items}>
        {items.length === 0 ? (
          <p className="table-muted" style={{ fontSize: 13 }}>No items yet. Add the first one below.</p>
        ) : (
          items.map((item) => <ItemRow key={item.id} item={item} />)
        )}
      </div>

      <details className={styles.addSection}>
        <summary className={styles.addSummary}>+ Add Item</summary>
        <form action={addAction} className={styles.addForm}>
          <input type="hidden" name="template_id" value={templateId} />
          {addState.error && <p className="form-error">{addState.error}</p>}
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label className="label">Label *</label>
              <input name="label" required className="input" placeholder="e.g. Trackpad functions appropriately" />
            </div>
            <div className="field">
              <label className="label">Result Type *</label>
              <select name="result_type" required className="select">
                <option value="boolean">Pass / Fail</option>
                <option value="text">Text</option>
                <option value="numeric">Numeric</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Required</label>
              <select name="required" className="select">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label className="label">Help Text</label>
              <input name="help_text" className="input" placeholder="Optional guidance for the technician" />
            </div>
          </div>
          <button type="submit" disabled={addPending} className="btn btn-primary btn-sm">
            {addPending ? 'Adding…' : 'Add Item'}
          </button>
        </form>
      </details>
    </div>
  )
}

function ItemRow({ item }: { item: Item }) {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string }, fd: FormData) => deleteChecklistItem(fd),
    {}
  )

  return (
    <div className={styles.item}>
      <span className={styles.itemOrder}>{item.order}.</span>
      <div className={styles.itemBody}>
        <span className={styles.itemLabel}>{item.label}</span>
        <div className={styles.itemMeta}>
          <span className="badge" style={{ background: '#f3f4f6', color: '#374151' }}>
            {item.result_type === 'boolean' ? 'Pass/Fail' : item.result_type}
          </span>
          {item.required && <span className="badge" style={{ background: '#fef9c3', color: '#a16207' }}>Required</span>}
          {item.help_text && <span className={styles.helpText}>{item.help_text}</span>}
        </div>
        {state.error && <p className="form-error" style={{ marginTop: 4 }}>{state.error}</p>}
      </div>
      <form action={action}>
        <input type="hidden" name="item_id" value={item.id} />
        <button type="submit" disabled={pending} className="btn btn-danger btn-sm"
          onClick={e => { if (!confirm('Delete this item?')) e.preventDefault() }}>
          ✕
        </button>
      </form>
    </div>
  )
}
