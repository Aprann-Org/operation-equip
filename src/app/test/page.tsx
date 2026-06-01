import { createClient } from '@/utils/supabase/server'
import { EditableTable } from './EditableTable'

export default async function TestPage() {
  const supabase = await createClient()
  const { data: items, error } = await supabase.from('test_items').select('*').order('id')

  if (error) {
    return <p style={{ color: 'red' }}>Error: {error.message}</p>
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Supabase Connection Test</h1>
      <EditableTable items={items} />
    </main>
  )
}
