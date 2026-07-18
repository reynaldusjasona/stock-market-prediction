import {useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

function ViewAlertModal({target, onClose, onDismissed}){
  const[loading,setLoading]=useState(false)

  const isResolved= target.is_resolved||target.status==='resolved'
  const sev= (target.severity||'info').toLowerCase()

  const SEV_COLOR={
    critical:'#ff4444',
    warning:'#ff8c00',
    info:'#60a5fa',
  }
  const sevColor=SEV_COLOR[sev]||'#60a5fa'

  const handleDismiss=async()=>{
    setLoading(true)
    try{
      await adminApi.dismissAlert(target.id)
      showToast('Alert marked as resolved', 'success')
      onDismissed?.(target.id)
      onClose?.()
    } 
	catch (err){
      showToast(err.message||'Failed to dismiss alert', 'error')
    } 
	finally{ 
		setLoading(false) 
	}
  }

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Alert Detail</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="admin-modal-body">
          {/* Severity + source row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginBottom:'1.25rem' }}>
            <div>
              <div className="admin-form-label">Severity</div>
              <span className={`status-badge status-${isResolved ? 'resolved' : sev}`}
                style={{ marginTop:'0.3rem', display:'inline-flex' }}>
                {isResolved ? 'Resolved' : sev}
              </span>
            </div>
            <div>
              <div className="admin-form-label">Source</div>
              <div style={{ fontWeight:600, marginTop:'0.3rem' }}>
                {target.source || target.service || '—'}
              </div>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <div className="admin-form-label">Triggered At</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.875rem', marginTop:'0.3rem' }}>
                {target.created_at
                  ? new Date(target.created_at).toLocaleString('en-SG', { dateStyle:'medium', timeStyle:'short' })
                  : '—'}
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="admin-form-label">Message</div>
          <div style={{ fontWeight:600, fontSize:'0.95rem', margin:'0.3rem 0 1.25rem',
            color: isResolved ? 'var(--text-muted)' : sevColor }}>
            {target.message || target.title || '—'}
          </div>

          {/* Details */}
          <div className="admin-form-label">Details</div>
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)',
            borderRadius:'8px', padding:'0.85rem 1rem', fontSize:'0.78rem',
            color:'var(--text-muted)', fontFamily:'var(--font-mono)',
            lineHeight:1.6, whiteSpace:'pre-wrap', marginTop:'0.3rem' }}>
            {target.details || target.description || 'No additional details.'}
          </div>
        </div>

        <div className="admin-modal-footer">
          <button className="btn-admin btn-ghost" onClick={onClose}>Close</button>
          {!isResolved && (
            <button className="btn-admin btn-success" onClick={handleDismiss} disabled={loading}>
              {loading
                ? <><span className="admin-spinner"/> Resolving…</>
                : <>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M2 6.5l3 3 6-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Mark as Resolved
                  </>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ViewAlertModal
