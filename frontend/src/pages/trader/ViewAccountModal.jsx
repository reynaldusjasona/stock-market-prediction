import '../../styles/admin/adminShared.css'
import '../../styles/trader/traderShared.css'

function readUser() {
  try{ 
	return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('sw_user') || '{}') 
	}
  catch{ 
	return {} 
	}
}

function ViewAccountModal({ onClose, onEdit }) {
  const user = readUser()

  const rows = [
    {label:'Name',value: user.name || user.full_name },
    {label:'Email',value: user.email },
    {label:'Phone',value: user.phone },
    {label:'Specialization',value: user.specialization },
    {label:'Years of Experience',value: user.years_experience ? `${user.years_experience} years` : null },
    {label:'License Number',value: user.license_number, mono: true },
    {label:'Bio',value: user.bio, full: true },
  ]

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">My Account</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="admin-modal-body">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'1rem' }}>
            {rows.filter(r => !r.full).map(r => (
              <div key={r.label} style={{ gridColumn: r.full ? '1/-1' : undefined }}>
                <div className="admin-form-label">{r.label}</div>
                <div style={{ fontFamily: r.mono ? 'var(--font-mono)' : undefined, fontSize:'0.85rem' }}>
                  {r.value || '—'}
                </div>
              </div>
            ))}
            <div style={{ gridColumn:'1/-1' }}>
              <div className="admin-form-label">Status</div>
              <span className={`status-badge ${user.trader_status === 'approved' ? 'status-active' : 'status-pending'}`}
                style={{ marginTop:'0.25rem', display:'inline-flex' }}>
                {user.trader_status || 'approved'}
              </span>
            </div>
            {user.bio && (
              <div style={{ gridColumn:'1/-1' }}>
                <div className="admin-form-label">Bio</div>
                <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', lineHeight:1.6 }}>{user.bio}</div>
              </div>
            )}
          </div>
          <p style={{ fontSize:'0.72rem', color:'var(--text-subtle)', margin:0 }}>
            License number is verified at approval — contact support to change.
          </p>
        </div>

        <div className="admin-modal-footer">
          <button className="btn-admin btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-admin btn-primary" onClick={onEdit}>Edit Account</button>
        </div>
      </div>
    </div>
  )
}

export default ViewAccountModal
