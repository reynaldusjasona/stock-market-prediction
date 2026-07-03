import {useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/api'
import '../../styles/admin/adminShared.css'

function EditAPIModal({target,onClose,onDone}){
  const [form, setForm] = useState({
    name:target.name||'',
    base_url:target.base_url|| target.url||'',
    api_key:'',
    purpose:target.purpose||target.description||'',
    rate_limit:target.rate_limit!= null?String(target.rate_limit):'',
    is_active:target.is_active!== false,
  })
  const [loading,setLoading]= useState(false)
  const [confirming,setConfirming]= useState(false)
  const [alert,setAlert]= useState({msg:'', type:''})

  const set =(f, v)=> setForm(p =>({ ...p, [f]: v }))

  const handleSave= async(e)=>{
    e.preventDefault()
    setAlert({msg:'', type:''})
    if (!form.name.trim()){ 
		setAlert({msg:'Name required.',type:'error'}); 
		return 
	}
    if (!form.base_url.trim()){ 
		setAlert({msg:'Base URL required.',type:'error'}); 
		return 
	}
    const payload = {name: form.name.trim(),base_url: form.base_url.trim(),
      purpose: form.purpose.trim(), rate_limit: form.rate_limit ? parseInt(form.rate_limit) : null,
      is_active: form.is_active}
    if (form.api_key.trim()) 
		payload.api_key = form.api_key.trim()
    setLoading(true)
    try{
      await adminApi.editApi(target.id, payload)
      showToast('API source updated', 'success')
      onDone?.(); onClose?.()
    } 
	catch (err) {
      setAlert({ msg: err.message || 'Failed.', type:'error' })
    } 
	finally{ 
	  setLoading(false) 
	}
  }

  const handleDelete= async()=>{
    setLoading(true)
    try{
      await adminApi.deleteApi(target.id)
      showToast('API source removed', 'success')
      onDone?.(); onClose?.()
    } 
	catch (err){
      setAlert({ msg: err.message || 'Failed.', type:'error' })
      setConfirming(false)
    } 
	finally{
	  setLoading(false) 
	}
  }

  if (confirming) 
	return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-confirm-box">
        <div className="admin-confirm-icon danger">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 7h16M8 7V5a1 1 0 011-1h4a1 1 0 011 1v2M5 7l1 12a1 1 0 001 1h8a1 1 0 001-1L17 7"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h3 className="admin-confirm-title">Remove API Source</h3>
        <p className="admin-confirm-msg">Remove <strong>{target.name}</strong>? Backend features relying on this source will stop receiving data.</p>
        <div className="admin-confirm-btns">
          <button className="btn-admin btn-ghost" onClick={() => setConfirming(false)} disabled={loading}>Cancel</button>
          <button className="btn-admin btn-danger" onClick={handleDelete} disabled={loading}>
            {loading ? <><span className="admin-spinner"/> Removing…</> : 'Yes, Remove'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Edit API Source</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>
        <form onSubmit={handleSave}>
          <div className="admin-modal-body">
            {alert.msg && <div className={`admin-alert ${alert.type}`}>{alert.msg}</div>}
            <div className="admin-form-group">
              <label className="admin-form-label">Source Name *</label>
              <input className="admin-form-input" type="text" value={form.name}
                onChange={e => set('name', e.target.value)} required/>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Base URL *</label>
              <input className="admin-form-input" type="url" value={form.base_url}
                onChange={e => set('base_url', e.target.value)} required/>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">New API Key <span style={{ opacity:0.6 }}>(leave blank to keep existing)</span></label>
              <input className="admin-form-input" type="password" placeholder="••••••••"
                value={form.api_key} onChange={e => set('api_key', e.target.value)} autoComplete="new-password"/>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Purpose</label>
              <input className="admin-form-input" type="text" value={form.purpose}
                onChange={e => set('purpose', e.target.value)}/>
            </div>
            <div style={{ display:'flex', gap:'1rem', alignItems:'flex-end' }}>
              <div className="admin-form-group" style={{ flex:1, marginBottom:0 }}>
                <label className="admin-form-label">Rate Limit (req/min)</label>
                <input className="admin-form-input" type="number" min="1" value={form.rate_limit}
                  onChange={e => set('rate_limit', e.target.value)}/>
              </div>
              <div className="admin-form-group" style={{ marginBottom:0 }}>
                <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer',
                  fontSize:'0.875rem', color:'var(--text-muted)', paddingBottom:'0.55rem' }}>
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => set('is_active', e.target.checked)}
                    style={{ accentColor:'var(--accent)' }}/>
                  Active
                </label>
              </div>
            </div>
          </div>
          <div className="admin-modal-footer" style={{ justifyContent:'space-between' }}>
            <button type="button" className="btn-admin btn-danger"
              onClick={() => setConfirming(true)} disabled={loading}>Remove Source</button>
            <div style={{ display:'flex', gap:'0.75rem' }}>
              <button type="button" className="btn-admin btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" className="btn-admin btn-primary" disabled={loading}>
                {loading ? <><span className="admin-spinner"/> Saving…</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditAPIModal
