import {useState, useEffect} from 'react'
import adminApi from '../../js/adminApi'
import '../../styles/admin/adminShared.css'

function ViewFeedbackModal({target, onClose, onApprove, onReject}){
  const[detail,setDetail]= useState(target)
  const[fetching,setFetching]= useState(true)

  const isPending=(f)=>(f?.status||'pending')==='pending'

  useEffect(()=>{
    adminApi.getFeedbackById(target.id)
      .then(full=>setDetail(full))
      .catch(()=>{ /* keep partial data from table row */ })
      .finally(()=>setFetching(false))
  }, [target.id])

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Feedback Detail</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="admin-modal-body">
          {fetching && <div style={{textAlign:'center', marginBottom:'1rem'}}><span className="admin-spinner"/></div>}

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginBottom:'1.25rem'}}>
            <div>
              <div className="admin-form-label">Submitted By</div>
              <div style={{fontWeight:600}}>{detail.user_name || detail.user_email || 'Anonymous'}</div>
            </div>
            <div>
              <div className="admin-form-label">Date</div>
              <div>{detail.created_at ? new Date(detail.created_at).toLocaleString('en-SG') : '—'}</div>
            </div>
            <div>
              <div className="admin-form-label">Status</div>
              <span className={`status-badge status-${(detail.status || 'pending').toLowerCase()}`}>
                {detail.status || 'pending'}
              </span>
            </div>
            <div>
              <div className="admin-form-label">Rating</div>
              <div style={{color:'#ffd600', fontFamily:'var(--font-mono)'}}>
                {detail.rating != null
                  ? `${'★'.repeat(Math.round(detail.rating))}${'☆'.repeat(5 - Math.round(detail.rating))} (${detail.rating}/5)`
                  : '—'}
              </div>
            </div>
          </div>

          <div className="admin-form-label">Message</div>
          <div style={{background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px',
            padding:'0.85rem 1rem', fontSize:'0.875rem', lineHeight:1.65,
            color:'var(--text-muted)', whiteSpace:'pre-wrap', marginTop:'0.4rem'}}>
            {detail.message || detail.content || '—'}
          </div>
        </div>

        {isPending(detail) ? (
          <div className="admin-modal-footer">
            <button className="btn-admin btn-ghost" onClick={onClose}>Close</button>
            <button className="btn-admin btn-danger"
              onClick={()=>{onClose?.(); 
							onReject?.(detail) 
					  }}>
              Reject
            </button>
            <button className="btn-admin btn-success"
              onClick={()=>{onClose?.(); 
							onApprove?.(detail)}
					  }>
              Approve &amp; 
			  Publish
            </button>
          </div>
        ):(
          <div className="admin-modal-footer">
            <button className="btn-admin btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ViewFeedbackModal
