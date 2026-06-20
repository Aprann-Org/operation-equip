import { createClient } from '@/utils/supabase/server'
import { SeedEquipment } from './SeedEquipment'

export default async function EquipmentTestPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('equipment')
    .select('id,organization_id,internal_id,stage')
    .limit(5)

  if (error) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>Equipment Table Test</h1>
        <p style={{ color: 'red' }}>Error querying equipment: {error.message}</p>
        <p>Check that your Supabase connection is configured and the migration has been applied.</p>
      </main>
    )
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Equipment Table Test</h1>
      <p>Query successful. Showing up to 5 equipment rows:</p>
      {data && data.length > 0 ? (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: '1rem' }}>
          <thead>
            <tr>
              {['ID', 'Organization ID', 'Internal ID', 'Stage'].map((label) => (
                <th key={label} style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left', background: '#f5f5f5' }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id as string}>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.id}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.organization_id}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.internal_id}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <p>No equipment rows found yet, but the table exists and is queryable.</p>
          <SeedEquipment />
        </>
      )}
    </main>
  )
}
