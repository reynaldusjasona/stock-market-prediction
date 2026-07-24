import {useEffect, useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

const badge  = s => s === 'approved' ? 'status-active' : s === 'rejected' ? 'status-suspended' : 'status-pending'
const status = u => u.trader_status || 'pending'

function ViewTraderAccountModal({ trader, onClose, onReviewed }) {
  const[reason,setReason]= useState('')
  const[rejecting,setRejecting]= useState(false)
  const[busy,setBusy]= useState(false)
  const[verifying,setVerifying]= useState(false)
  const[verification,setVerification]= useState(null)

  useEffect(() => {
    if (!trader.license_number) {
      setVerification({ valid: false, reason: 'No license number provided' })
      return
    }
    setVerifying(true)
    adminApi.verifyLicense(trader.license_number)
      .then(d => setVerification(d))
      .catch(() => setVerification({ valid: false, reason: 'Verification service unavailable' }))
      .finally(() => setVerifying(false))
  }, [trader.license_number])

  const handleApprove = async () => {
    setBusy(true)
    try {
      await adminApi.approveTrader(trader.id)
      showToast(`${trader.name || trader.email} approved as trader`, 'success')
      onReviewed?.()
    } catch (err) { showToast(err.message || 'Failed to approve', 'error') }
    finally { setBusy(false) }
  }

  const handleReject = async () => {
    if (!reason.trim()){ 
	  showToast('Please provide a rejection reason', 'error'); 
	  return 
	 }
    setBusy(true)
    try{
      await adminApi.rejectTrader(trader.id, reason.trim())
      showToast(`${trader.name || trader.email} application rejected`, 'success')
      onReviewed?.()
    } 
	catch (err){ 
	  showToast(err.message || 'Failed to reject', 'error') 
	 }
    finally{ 
	  setBusy(false) 
	}
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Trader Account</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="admin-modal-body">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'1.25rem' }}>
            <div>
              <div className="admin-form-label">Name</div>
              <div style={{ fontWeight:600 }}>{trader.name || trader.full_name || '—'}</div>
            </div>
            <div>
              <div className="admin-form-label">Status</div>
              <span className={`status-badge ${badge(status(trader))}`} style={{ marginTop:'0.25rem', display:'inline-flex' }}>
                {status(trader)}
              </span>
            </div>
            <div>
              <div className="admin-form-label">Email</div>
              <div style={{ fontSize:'0.85rem' }}>{trader.email || '—'}</div>
            </div>
            <div>
              <div className="admin-form-label">Phone</div>
              <div style={{ fontSize:'0.85rem' }}>{trader.phone || '—'}</div>
            </div>
            <div>
              <div className="admin-form-label">Specialization</div>
              <div style={{ fontSize:'0.85rem' }}>{trader.specialization || '—'}</div>
            </div>
            <div>
              <div className="admin-form-label">Years of Experience</div>
              <div style={{ fontSize:'0.85rem' }}>{trader.years_experience ? `${trader.years_experience} years` : '—'}</div>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <div className="admin-form-label">License Number</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem' }}>{trader.license_number || '—'}</div>
            </div>
            <div>
              <div className="admin-form-label">Registered</div>
              <div style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>
                {trader.created_at ? new Date(trader.created_at).toLocaleString('en-SG', { dateStyle:'medium', timeStyle:'short' }) : '—'}
              </div>
            </div>
          </div>

          {/* Auto license verification result */}
          <div style={{ marginBottom:'1.25rem' }}>
            <div className="admin-form-label">License Verification</div>
            {verifying ? (
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.7rem 1rem',
                background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px',
                fontSize:'0.82rem', color:'var(--text-muted)' }}>
                <span className="admin-spinner" style={{ width:'14px', height:'14px' }}/>
                Verifying license number with registry...
              </div>
            ) : verification?.valid ? (
              <div style={{ padding:'0.7rem 1rem', background:'rgba(0,255,65,0.07)',
                border:'1px solid rgba(0,255,65,0.3)', borderRadius:'8px', fontSize:'0.82rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.4rem' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="#00ff41" strokeWidth="1.2"/>
                    <path d="M4 7l2 2 4-4" stroke="#00ff41" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ color:'var(--accent)', fontWeight:600 }}>License Verified</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.3rem', color:'var(--text-muted)' }}>
                  <span>Authority: <span style={{ color:'var(--text)' }}>{verification.authority}</span></span>
                  <span>Status: <span style={{ color:'var(--text)' }}>{verification.status}</span></span>
                  {verification.holder && (
                    <span style={{ gridColumn:'1/-1' }}>Holder: <span style={{ color:'var(--text)' }}>{verification.holder}</span></span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding:'0.7rem 1rem', background:'rgba(255,68,68,0.08)',
                border:'1px solid rgba(255,68,68,0.25)', borderRadius:'8px', fontSize:'0.82rem', color:'#ff6b6b' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="#ff4444" strokeWidth="1.2"/>
                    <path d="M5 5l4 4M9 5l-4 4" stroke="#ff4444" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontWeight:600 }}>License Not Verified</span>
                </div>
                {verification?.reason && <div style={{ marginTop:'0.25rem', color:'#ff8888' }}>{verification.reason}</div>}
              </div>
            )}
          </div>

          {trader.rejection_reason && (
            <div style={{ background:'rgba(255,68,68,0.08)', border:'1px solid rgba(255,68,68,0.25)',
              borderRadius:'8px', padding:'0.7rem 1rem', fontSize:'0.8rem', color:'#ff6b6b', marginBottom:'1.1rem' }}>
              Previously rejected: {trader.rejection_reason}
            </div>
          )}

          {status(trader) === 'pending' && rejecting && (
            <div className="admin-form-group" style={{ marginBottom:0 }}>
              <label className="admin-form-label" htmlFor="vtaReason">Rejection Reason *</label>
              <textarea className="admin-form-textarea" id="vtaReason" style={{ minHeight:'80px' }}
                placeholder="e.g. License number could not be verified"
                value={reason} onChange={e => setReason(e.target.value)}/>
            </div>
          )}
        </div>

        <div className="admin-modal-footer">
          <button className="btn-admin btn-ghost" onClick={onClose} disabled={busy}>Close</button>
          {status(trader) === 'pending' && (rejecting ? (
            <>
              <button className="btn-admin btn-ghost" onClick={() => setRejecting(false)} disabled={busy}>Back</button>
              <button className="btn-admin btn-danger" onClick={handleReject} disabled={busy}>
                {busy ? <><span className="admin-spinner"/> Rejecting…</> : 'Confirm Reject'}
              </button>
            </>
          ) : (
            <>
              <button className="btn-admin btn-danger" onClick={() => setRejecting(true)} disabled={busy}>Reject</button>
              <button className="btn-admin btn-success" onClick={handleApprove} disabled={busy || verifying}>
                {busy ? <><span className="admin-spinner"/> Approving…</> : 'Approve Trader'}
              </button>
            </>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ViewTraderAccountModal
