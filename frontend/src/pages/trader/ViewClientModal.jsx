import '../../styles/admin/adminShared.css'
import '../../styles/trader/traderShared.css'

function ViewClientModal({client, onClose}) {
  if (!client) 
	  return null

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Client Details</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="admin-modal-body">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem' }}>
            <div>
              <div className="admin-form-label">Name</div>
              <div style={{ fontWeight:600 }}>{client.name || client.full_name || '—'}</div>
            </div>
            <div>
              <div className="admin-form-label">Email</div>
              <div style={{ fontSize:'0.85rem' }}>{client.email || '—'}</div>
            </div>
            <div>
              <div className="admin-form-label">Risk Tolerance</div>
              <div style={{ fontSize:'0.85rem', textTransform:'capitalize' }}>{client.risk_tolerance || '—'}</div>
            </div>
            <div>
              <div className="admin-form-label">Engaged Since</div>
              <div style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>
                {client.engaged_at || client.created_at
                  ? new Date(client.engaged_at || client.created_at).toLocaleDateString('en-SG', { dateStyle:'medium' })
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="admin-modal-footer">
          <button className="btn-admin btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default ViewClientModal
