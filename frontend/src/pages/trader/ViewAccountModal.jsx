import '../../styles/admin/adminShared.css'

function readUser() {
  try{ 
	return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('sw_user') || '{}') 
	}
  catch{ 
    return {} 
	}
}

function ViewAccountModal({onClose, onEdit}){
  const user = readUser()

  return (
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
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'1.1rem'}}>
            <div>
              <div className="admin-form-label">Name</div>
              <div style={{fontWeight:600}}>{user.name || user.full_name || '—'}</div>
            </div>
            <div>
              <div className="admin-form-label">Status</div>
              <span className={`status-badge ${user.trader_status === 'approved' ? 'status-active' : 'status-pending'}`}
                style={{ marginTop:'0.25rem', display:'inline-flex' }}>
                {user.trader_status || 'approved'}
              </span>
            </div>
            <div>
              <div className="admin-form-label">Email</div>
              <div style={{ fontSize:'0.85rem' }}>{user.email || '—'}</div>
            </div>
            <div>
              <div className="admin-form-label">License Number</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem' }}>{user.license_number || '—'}</div>
            </div>
          </div>
          <p style={{ fontSize:'0.72rem', color:'var(--text-subtle)', margin:0 }}>
            License number is verified at approval. Contact support to request a change.
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
