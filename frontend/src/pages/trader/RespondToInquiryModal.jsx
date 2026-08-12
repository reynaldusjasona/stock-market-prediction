import {useState} from 'react'
import traderApi from '../../js/traderApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'
import '../../styles/trader/traderShared.css'

function RespondToInquiryModal({ inquiry, onClose, onResponded }) {
  const[response, setResponse] = useState('')
  const[busy, setBusy] = useState(false)

  if (!inquiry)
	  return null

  const handleSubmit = async () => {
    if (!response.trim()) return
    setBusy(true)
    try{
      await traderApi.respondToInquiry({ id: inquiry.id, response: response.trim() })
      showToast(`Response sent for ${inquiry.ticker}`, 'success')
      onResponded?.()
    }
	catch (err){
      showToast(err.message || 'Failed to send response', 'error')
    }
	finally{
	  setBusy(false)
	}
  }

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Respond — {inquiry.ticker}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="admin-modal-body">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'1.25rem' }}>
            <div>
              <div className="admin-form-label">Ticker</div>
              <div style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{inquiry.ticker}</div>
            </div>
            <div>
              <div className="admin-form-label">Asked By</div>
              <div style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>
                {inquiry.investor_name || (inquiry.investor_id ? `Investor #${inquiry.investor_id.slice(0,8)}` : '—')}
              </div>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <div className="admin-form-label">Question</div>
              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px',
                padding:'0.7rem 0.9rem', fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.6 }}>
                {inquiry.message || '—'}
              </div>
            </div>
          </div>
          <div className="admin-form-group" style={{ marginBottom:0 }}>
            <label className="admin-form-label" htmlFor="inquiryResponse">Your Response</label>
            <textarea className="admin-form-textarea" id="inquiryResponse" maxLength={1000}
              placeholder="Share your analysis or answer the investor's question…"
              value={response} onChange={e => setResponse(e.target.value)}/>
          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-admin btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-admin btn-success" onClick={handleSubmit} disabled={busy || !response.trim()}>
            {busy ? <span className="admin-spinner"/> : 'Send Response'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RespondToInquiryModal
