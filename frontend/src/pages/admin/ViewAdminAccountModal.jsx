import '../../styles/admin/adminShared.css'

const AVT=['#2563eb','#7c3aed','#0891b2','#0d9488','#d97706','#dc2626','#9333ea','#16a34a']
const avatarColor= s => { let h=0; for(const c of(s||''))h=(h*31+c.charCodeAt(0))%AVT.length; return AVT[h] }
const initials= s => (s||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)

function ViewAdminAccountModal({ onClose }) {
  const user= JSON.parse(sessionStorage.getItem('sw_user') || '{}')
  const name= user.name  || user.full_name || 'Administrator'
  const email= user.email || '—'
  const role= user.role || 'admin'
  const id= user.id ||user.user_id || '—'

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true" style={{ maxWidth:'360px' }}>
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">My Account</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="admin-modal-body">
          {/* Avatar + name */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'1.75rem', paddingBottom:'1.25rem', borderBottom:'1px solid var(--border)' }}>
            <div style={{
              width:'64px', height:'64px', borderRadius:'50%',
              background: avatarColor(name),
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'1.3rem', fontWeight:700, color:'#000',
              marginBottom:'0.75rem',
            }}>
              {initials(name)}
            </div>
            <div style={{ fontWeight:700, fontSize:'1rem', color:'var(--text)' }}>{name}</div>
            <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:'0.2rem' }}>{email}</div>
            <span style={{
              marginTop:'0.6rem', fontSize:'0.68rem', fontWeight:700,
              letterSpacing:'0.08em', textTransform:'uppercase',
              background:'rgba(255,140,0,0.12)', color:'#ff8c00',
              border:'1px solid rgba(255,140,0,0.25)', borderRadius:'4px',
              padding:'0.15rem 0.5rem',
            }}>
              {role}
            </span>
          </div>

          {/* Detail fields */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {[
              {label:'User ID',val: id},
              {label:'Email',val: email},
              {label:'Role', val: role},
              {label:'Session',val: 'Active — expires on browser close'},
            ].map(f => (
              <div key={f.label}>
                <div className="admin-form-label">{f.label}</div>
                <div style={{ fontSize:'0.875rem', color:'var(--text)', marginTop:'0.2rem' }}>{f.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-modal-footer">
          <button className="btn-admin btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default ViewAdminAccountModal
