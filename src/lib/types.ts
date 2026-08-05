export type OrgType = 'tenant' | 'donor' | 'recipient' | 'both'
export type OrgStatus = 'active' | 'archived'

export type EquipmentStage =
  | 'acquired'
  | 'received'
  | 'in_process'
  | 'ready_for_distribution'
  | 'distributed'
  | 'in_support'
  | 'retired'

export type EquipmentSubStatus =
  | 'testing'
  | 'repairing'
  | 'awaiting_parts'
  | 'awaiting_software'
  | 'final_qa'
  | 'blocked'

export type CosmeticCondition = 'good' | 'fair' | 'poor'
export type RetirementReason = 'lost' | 'broken' | 'returned_to_donor' | 'end_of_life' | 'other'
export type NoteVisibility = 'internal' | 'recipient_visible'
export type SupportThreadStatus = 'open' | 'awaiting_recipient' | 'awaiting_tech' | 'resolved' | 'closed'
export type UserRole = 'super_admin' | 'org_admin' | 'technician' | 'recipient'

export type Organization = {
  id: string
  name: string
  type: OrgType
  status: OrgStatus
  ein: string | null
  key_contact_name: string | null
  key_contact_email: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export type EquipmentType = {
  id: string
  name: string
  spec_schema: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type Equipment = {
  id: string
  organization_id: string
  equipment_type_id: string
  internal_id: string
  donor_organization_id: string | null
  source_detail: string | null
  sponsor_name: string | null
  sponsor_email: string | null
  make: string | null
  model: string | null
  processor: string | null
  ram_gb: number | null
  disk_capacity_gb: number | null
  specs: Record<string, unknown> | null
  cosmetic_condition: CosmeticCondition | null
  cosmetic_notes: string | null
  stage: EquipmentStage
  sub_status: EquipmentSubStatus | null
  assigned_technician_id: string | null
  tech_due_date: string | null
  destination_organization_id: string | null
  destination_person_id: string | null
  date_acquired: string | null
  date_received: string | null
  date_sent: string | null
  date_delivered: string | null
  retirement_reason: RetirementReason | null
  retirement_notes: string | null
  created_at: string
  updated_at: string
  created_by_user_id: string | null
}

export type StageHistory = {
  id: string
  equipment_id: string
  from_stage: EquipmentStage | null
  to_stage: EquipmentStage
  occurred_at: string
  reason: string | null
  user: { first_name: string; last_name: string } | null
}

export type EquipmentNote = {
  id: string
  equipment_id: string
  note: string
  visibility: NoteVisibility
  created_at: string
  user: { first_name: string; last_name: string; email: string } | null
}

export type ChecklistItem = {
  id: string
  checklist_template_id: string
  order: number
  label: string
  result_type: 'boolean' | 'text' | 'numeric'
  required: boolean
  help_text: string | null
}

export type ChecklistResult = {
  id: string
  equipment_id: string
  checklist_item_id: string
  result_boolean: boolean | null
  result_text: string | null
  result_numeric: number | null
  completed_at: string
}

export type SupportThread = {
  id: string
  equipment_id: string
  subject: string
  status: SupportThreadStatus
  opened_at: string
  closed_at: string | null
}

export type SupportMessage = {
  id: string
  support_thread_id: string
  body: string
  sent_at: string
  user: { first_name: string; last_name: string; email: string } | null
}

export const STAGE_ORDER: EquipmentStage[] = [
  'acquired',
  'received',
  'in_process',
  'ready_for_distribution',
  'distributed',
]

export const STAGE_LABELS: Record<EquipmentStage, string> = {
  acquired: 'Acquired',
  received: 'Received',
  in_process: 'In Process',
  ready_for_distribution: 'Ready to Ship',
  distributed: 'Distributed',
  in_support: 'In Support',
  retired: 'Retired',
}

/** Every stage, in lifecycle order — the two terminal stages follow the pipeline. */
export const ALL_STAGES: EquipmentStage[] = [...STAGE_ORDER, 'in_support', 'retired']

export const SUB_STATUSES: EquipmentSubStatus[] = [
  'testing',
  'repairing',
  'awaiting_parts',
  'awaiting_software',
  'final_qa',
  'blocked',
]

export const SUB_STATUS_LABELS: Record<EquipmentSubStatus, string> = {
  testing: 'Testing',
  repairing: 'Repairing',
  awaiting_parts: 'Awaiting Parts',
  awaiting_software: 'Awaiting Software',
  final_qa: 'Final QA',
  blocked: 'Blocked',
}

export const COSMETIC_CONDITIONS: CosmeticCondition[] = ['good', 'fair', 'poor']

export const COSMETIC_CONDITION_LABELS: Record<CosmeticCondition, string> = {
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
}

export const RETIREMENT_REASONS: RetirementReason[] = [
  'lost',
  'broken',
  'returned_to_donor',
  'end_of_life',
  'other',
]

export const RETIREMENT_REASON_LABELS: Record<RetirementReason, string> = {
  lost: 'Lost',
  broken: 'Broken beyond repair',
  returned_to_donor: 'Returned to donor',
  end_of_life: 'End of life',
  other: 'Other',
}

export const STAGE_COLORS: Record<EquipmentStage, string> = {
  acquired: '#6b7280',
  received: '#2563eb',
  in_process: '#d97706',
  ready_for_distribution: '#7c3aed',
  distributed: '#16a34a',
  in_support: '#ea580c',
  retired: '#9ca3af',
}
