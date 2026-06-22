import { OrgForm } from './OrgForm'

export const metadata = { title: 'Add Organization — Operation Equip' }

export default function NewOrganizationPage() {
  return (
    <div className="page-container" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Add Organization</h1>
          <p className="page-subtitle">Register a donor, recipient, or partner organization.</p>
        </div>
        <a href="/organizations" className="btn btn-secondary">← Back</a>
      </div>

      <div className="card card-body">
        <OrgForm />
      </div>
    </div>
  )
}
