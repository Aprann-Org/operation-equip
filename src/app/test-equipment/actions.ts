'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createSampleEquipment(formData: FormData) {
  const supabase = createAdminClient()

  const orgName = 'Equipment Test Org'
  const { data: existingOrg, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('name', orgName)
    .limit(1)
    .maybeSingle()

  if (orgError) {
    throw new Error(`Unable to query organizations: ${orgError.message}`)
  }

  let organizationId = existingOrg?.id
  if (!organizationId) {
    const { data: newOrg, error: insertOrgError } = await supabase
      .from('organizations')
      .insert({ name: orgName, type: 'tenant' })
      .select('id')
      .single()

    if (insertOrgError) {
      throw new Error(`Unable to create test organization: ${insertOrgError.message}`)
    }

    organizationId = newOrg.id
  }

  const typeName = 'Laptop'
  const { data: existingType, error: typeError } = await supabase
    .from('equipment_types')
    .select('id')
    .eq('name', typeName)
    .limit(1)
    .maybeSingle()

  if (typeError) {
    throw new Error(`Unable to query equipment types: ${typeError.message}`)
  }

  let equipmentTypeId = existingType?.id
  if (!equipmentTypeId) {
    const { data: newType, error: insertTypeError } = await supabase
      .from('equipment_types')
      .insert({ name: typeName, spec_schema: { sample: true } })
      .select('id')
      .single()

    if (insertTypeError) {
      throw new Error(`Unable to create test equipment type: ${insertTypeError.message}`)
    }

    equipmentTypeId = newType.id
  }

  const internalId = `TEST-${Date.now()}`
  const { error: insertEquipmentError } = await supabase.from('equipment').insert({
    organization_id: organizationId,
    equipment_type_id: equipmentTypeId,
    internal_id: internalId,
    make: 'Test Make',
    model: 'Test Model',
    processor: 'Intel Core i5',
    ram_gb: 8,
    disk_capacity_gb: 256,
    specs: { os: 'Test OS', disk_type: 'ssd' },
  })

  if (insertEquipmentError) {
    throw new Error(`Unable to create test equipment row: ${insertEquipmentError.message}`)
  }

  revalidatePath('/test-equipment')
}
