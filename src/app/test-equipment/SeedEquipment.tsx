'use client'

import { createSampleEquipment } from './actions'

export function SeedEquipment() {
  return (
    <form action={createSampleEquipment} style={{ marginTop: '1rem' }}>
      <button type="submit">Create sample equipment</button>
    </form>
  )
}
