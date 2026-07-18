import {useState, useEffect} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

function ViewAPIModal({target, onClose, onEdit}){
  const[api,setApi]= useState(target||null)
  const[loading,setLoading]= useState(false)

  useEffect(()=>{
    if (target?.id && !target.base_url){
      setLoading(true)
      adminApi.getApiById(target.id)
        .then(setApi)
        .catch(err=>showToast(err.message||'Failed to load API source', 'error'))
        .finally(()=>setLoading(false))
    }
  }, [target?.id])

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">API Source Detail</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="admin-modal-body">
          {loading ? (
            <div style={{textAlign:'center', padding:'2rem'}}><span className="admin-spinner"/></div>
          ) : !api ? (
            <div className="admin-empty"><p>API source not found.</p></div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
              {[
                {label:'Source Name', val: api.name || '—', mono: false},
                {label:'Base URL',val: api.base_url || api.url || '—', mono: true},
                {label:'Purpose',val: api.purpose || api.description || '—', mono: false},
                {label:'Rate Limit',val: api.rate_limit != null ? `${api.rate_limit} req/min` : '—', mono: false},
                {label:'API Key',val: '•••••••••••• (stored encrypted)', mono: false},
              ].map(f=>(
                <div key={f.label}>
                  <div className="admin-form-label">{f.label}</div>
                  <div style={{fontSize:'0.875rem', color:'var(--text)', marginTop:'0.2rem', fontFamily: f.mono ? 'var(--font-mono)' : 'inherit', wordBreak:'break-all'}}>
                    {f.val}
                  </div>
                </div>
              ))}
              <div>
                <div className="admin-form-label">Status</div>
                <span className={`status-badge ${api.is_active!==false?'status-active':'status-suspended'}`} style={{marginTop:'0.2rem', display:'inline-flex'}}>
                  {api.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          )}
        </div>

        {api && (
          <div className="admin-modal-footer">
            <button className="btn-admin btn-ghost" onClick={onClose}>Close</button>
            <button className="btn-admin btn-primary" onClick={()=>{onClose?.(); onEdit?.(api)}}>
              Edit Source
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ViewAPIModal
