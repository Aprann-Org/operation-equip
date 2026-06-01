'use client'

import { useState } from 'react'
import { updateItem } from './actions'

type Item = {
  id: number
  name: string
  description: string
  created_at: string
}

const cell: React.CSSProperties = { border: '1px solid #ccc', padding: '8px' }

export function EditableTable({ items }: { items: Item[] }) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await updateItem(new FormData(e.currentTarget))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['ID', 'Name', 'Description', 'Created At', ''].map((h) => (
              <th key={h} style={{ ...cell, textAlign: 'left', background: '#f5f5f5' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) =>
            editingId === item.id ? (
              <tr key={item.id}>
                <form id={`edit-${item.id}`} onSubmit={handleSubmit}>
                  <input type="hidden" name="id" value={item.id} />
                </form>
                <td style={cell}>{item.id}</td>
                <td style={cell}>
                  <input
                    form={`edit-${item.id}`}
                    name="name"
                    defaultValue={item.name}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={cell}>
                  <input
                    form={`edit-${item.id}`}
                    name="description"
                    defaultValue={item.description ?? ''}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={cell}>{new Date(item.created_at).toLocaleString()}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  <button form={`edit-${item.id}`} type="submit" disabled={pending}>
                    {pending ? 'Saving…' : 'Save'}
                  </button>{' '}
                  <button type="button" onClick={() => setEditingId(null)} disabled={pending}>
                    Cancel
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={item.id}>
                <td style={cell}>{item.id}</td>
                <td style={cell}>{item.name}</td>
                <td style={cell}>{item.description}</td>
                <td style={cell}>{new Date(item.created_at).toLocaleString()}</td>
                <td style={cell}>
                  <button type="button" onClick={() => setEditingId(item.id)}>
                    Edit
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  )
}
