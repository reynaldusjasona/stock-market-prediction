import {useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

function RejectFeedbackModal({target,onClose,onDone}){
  const[reason,setReason]= useState('')
  const[loading,setLoading]= useState(false)
  const[alert,setAlert]= useState({msg:'', type:''})

  const handleReject = async(e)=>{
    e.preventDefault()
    setAlert({msg:'', type:''})
    setLoading(true)
    try{
      await adminApi.rejectFeedback(target.id, reason.trim())
      showToast('Feedback rejected', 'success')
      onDone?.(); 
	  onClose?.()
    } 
	catch (err){
      setAlert({msg: err.message||'Failed to reject feedback.',type:'error'})
    } 
	finally{ 
	  setLoading(false) 
	  }
  }

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Reject Feedback</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>
        <form onSubmit={handleReject}>
          <div className="admin-modal-body">
            {alert.msg && <div className={`admin-alert ${alert.type}`}>{alert.msg}</div>}
            <p style={{ margin:'0 0 1.25rem', fontSize:'0.875rem', color:'var(--text-muted)', lineHeight:1.6 }}>
              Reject feedback from <strong style={{ color:'var(--text)' }}>{target.user_name || 'Anonymous'}</strong>?
              It will not be published.
            </p>
            <div className="admin-form-group" style={{ marginBottom:0 }}>
              <label className="admin-form-label" htmlFor="rejReason">
                Rejection Reason <span style={{ opacity:0.6 }}>(optional)</span>
              </label>
              <textarea className="admin-form-textarea" id="rejReason"
                placeholder="e.g. Contains inappropriate language, off-topic, spam…"
                value={reason} onChange={e => setReason(e.target.value)}
                style={{ minHeight:'90px' }}/>
            </div>
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="btn-admin btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-admin btn-danger" disabled={loading}>
              {loading ? <><span className="admin-spinner"/> Rejecting…</> : 'Reject Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RejectFeedbackModal
