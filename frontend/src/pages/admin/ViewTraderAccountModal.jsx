import {useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

const badge = s => s === 'approved' ? 'status-active' : s === 'rejected' ? 'status-suspended' : 'status-pending'
const status = u => u.trader_status || 'pending'

function ViewTraderAccountModal({ trader, onClose, onReviewed }) {
  const[reason,setReason]= useState('')
  const[rejecting,setRejecting]= useState(false)
  const[busy,setBusy]= useState(false)

  const handleApprove = async () => {
    setBusy(true)
    try {
      await adminApi.approveTrader(trader.id)
      showToast(`${trader.name || trader.email} approved as trader`, 'success')
      onReviewed?.()
    } catch (err) { showToast(err.message || 'Failed to approve trader', 'error') }
    finally { setBusy(false) }
  }

  const handleReject = async () => {
    if (!reason.trim()) { showToast('Please provide a rejection reason', 'error'); return }
    setBusy(true)
    try{
      await adminApi.rejectTrader(trader.id, reason.trim())
      showToast(`${trader.name || trader.email} trader application rejected`, 'success')
      onReviewed?.()
    } 
	catch (err){ 
	  showToast(err.message || 'Failed to reject trader', 'error') 
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
              <div className="admin-form-label">License Number</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem' }}>{trader.license_number || '—'}</div>
              {trader.license_number && (
                <div style={{ display:'flex', gap:'0.7rem', marginTop:'0.35rem' }}>
                  <a href={`https://eservices.mas.gov.sg/fid/institution?count=100&search=${encodeURIComponent(trader.license_number)}`}
                    target="_blank" rel="noreferrer" style={{ fontSize:'0.72rem', color:'var(--accent)', textDecoration:'none' }}>
                    Verify on MAS FID ↗
                  </a>
                  <a href={`https://www.google.com/search?q=${encodeURIComponent('"' + trader.license_number + '" financial license')}`}
                    target="_blank" rel="noreferrer" style={{ fontSize:'0.72rem', color:'var(--text-muted)', textDecoration:'none' }}>
                    Search ↗
                  </a>
                </div>
              )}
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <div className="admin-form-label">Registered</div>
              <div style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>
                {trader.created_at ? new Date(trader.created_at).toLocaleString('en-SG', { dateStyle:'medium', timeStyle:'short' }) : '—'}
              </div>
            </div>
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
                placeholder="e.g. License number could not be verified against the registry"
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
              <button className="btn-admin btn-success" onClick={handleApprove} disabled={busy}>
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
