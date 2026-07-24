import {useState} from 'react'
import traderApi from '../../js/traderApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'
import '../../styles/trader/traderShared.css'

const SIGNAL_COLOR = { Buy:'#00ff41', Hold:'#60a5fa', Sell:'#ff4444' }

function EndorseSignalModal({ signal, onClose, onEndorsed }) {
  const[note, setNote] = useState('')
  const[busy, setBusy] = useState(false)

  if (!signal) 
	  return null

  const handleEndorse= async (verdict) => {
    setBusy(true)
    try{
      await traderApi.endorseSignal({ ticker: signal.ticker, verdict, note: note.trim() })
      showToast(`${signal.ticker} marked as ${verdict}`, 'success')
      onEndorsed?.()
    } 
	catch (err){
      showToast(err.message || 'Failed to submit endorsement', 'error')
    } 
	finally{ 
	  setBusy(false) 
	}
  }

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Review Signal — {signal.ticker}</h2>
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
              <div style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{signal.ticker}</div>
            </div>
            <div>
              <div className="admin-form-label">AI Signal</div>
              <div style={{ fontWeight:700, color: SIGNAL_COLOR[signal.signal] || 'var(--text)' }}>{signal.signal}</div>
            </div>
            <div>
              <div className="admin-form-label">Confidence</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem' }}>
                {signal.confidence_score != null ? `${Number(signal.confidence_score).toFixed(1)}%` : '—'}
              </div>
            </div>
            <div>
              <div className="admin-form-label">Requested By</div>
              <div style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>
                {signal.requested_by_name || signal.requested_by || '—'}
              </div>
            </div>
            {signal.reasoning && (
              <div style={{ gridColumn:'1/-1' }}>
                <div className="admin-form-label">AI Reasoning</div>
                <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px',
                  padding:'0.7rem 0.9rem', fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.6 }}>
                  {signal.reasoning}
                </div>
              </div>
            )}
          </div>

          <div className="admin-form-group" style={{ marginBottom:0 }}>
            <label className="admin-form-label" htmlFor="esNote">Note for the Investor (optional)</label>
            <textarea className="admin-form-textarea" id="esNote" maxLength={300}
              placeholder="e.g. Agree with the signal, but consider waiting for the earnings report on Friday…"
              value={note} onChange={e => setNote(e.target.value)}/>
          </div>
        </div>

        <div className="admin-modal-footer">
          <button className="btn-admin btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-admin btn-danger" onClick={() => handleEndorse('disagree')} disabled={busy}>
            {busy ? <span className="admin-spinner"/> : 'Disagree'}
          </button>
          <button className="btn-admin btn-success" onClick={() => handleEndorse('agree')} disabled={busy}>
            {busy ? <span className="admin-spinner"/> : 'Agree'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EndorseSignalModal
