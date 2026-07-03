import {useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/api'
import '../../styles/admin/adminShared.css'

function ApproveFeedbackModal({target, onClose, onDone}){
  const[loading, setLoading]= useState(false)
  const preview= (target.message || target.content || '').slice(0, 120)

  const handleApprove= async()=>{
    setLoading(true)
    try{
      await adminApi.approveFeedback(target.id)
      showToast('Feedback approved and published', 'success')
      onDone?.(); onClose?.()
    } 
	catch (err){
      showToast(err.message||'Failed to approve feedback', 'error')
    } 
	finally{
	  setLoading(false) 
	}
  }

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-confirm-box" style={{ maxWidth:'460px' }}>
        <div className="admin-confirm-icon" style={{ background:'rgba(0,255,65,0.1)', color:'#00ff41' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M7 11l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h3 className="admin-confirm-title">Approve Feedback</h3>
        <p className="admin-confirm-msg">
          Approve feedback from <strong>{target.user_name || 'Anonymous'}</strong>?
          It will be published to the public landing page.
        </p>
        {preview && (
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px',
            padding:'0.75rem 1rem', fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.6,
            textAlign:'left', marginBottom:'1.5rem', fontStyle:'italic' }}>
            "{preview}{(target.message || '').length > 120 ? '…' : ''}"
          </div>
        )}
        <div className="admin-confirm-btns">
          <button className="btn-admin btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-admin btn-success" onClick={handleApprove} disabled={loading}>
            {loading ? <><span className="admin-spinner"/> Approving…</> : 'Approve & Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ApproveFeedbackModal
