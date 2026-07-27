import {useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

function AddAPIModal({onClose, onDone}){
  const [form, setForm] = useState({
    name:'',
    base_url:'',
    api_key_masked:'',
    api_type:'REST',
    description:'',
    rate_limit:'',
    is_enable: true,
    status:'active',
  })
  const [loading, setLoading] = useState(false)
  const [alert,   setAlert]   = useState({msg:'', type:''})

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    setAlert({msg:'', type:''})
    if (!form.name.trim())     { setAlert({msg:'Name is required.',     type:'error'}); return }
    if (!form.base_url.trim()) { setAlert({msg:'Base URL is required.', type:'error'}); return }

    const payload = {
      name:           form.name.trim(),
      base_url:       form.base_url.trim(),
      api_key_masked: form.api_key_masked.trim(),
      api_type:       form.api_type,
      description:    form.description.trim(),
      rate_limit:     form.rate_limit.trim() || null,
      is_enable:      form.is_enable,
      status:         form.status,
    }

    setLoading(true)
    try {
      await adminApi.addApi(payload)
      showToast('API source added', 'success')
      onDone?.(); onClose?.()
    } catch (err) {
      setAlert({ msg: err.message || 'Failed to add API source.', type:'error' })
    } finally { setLoading(false) }
  }

  const selectStyle = {
    width:'100%', padding:'0.55rem 0.85rem', borderRadius:'8px',
    background:'var(--bg)', border:'1px solid var(--border)',
    color:'var(--text)', fontSize:'0.875rem', fontFamily:'var(--font-sans)'
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Add API Source</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="admin-modal-body">
            {alert.msg && <div className={`admin-alert ${alert.type}`}>{alert.msg}</div>}

            <div className="admin-form-group">
              <label className="admin-form-label">Source Name *</label>
              <input className="admin-form-input" type="text" placeholder="e.g. Alpha Vantage"
                value={form.name} onChange={e => set('name', e.target.value)} required/>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Base URL *</label>
              <input className="admin-form-input" type="url" placeholder="https://api.example.com"
                value={form.base_url} onChange={e => set('base_url', e.target.value)} required/>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">API Key <span style={{opacity:0.6}}>(stored encrypted)</span></label>
              <input className="admin-form-input" type="password" placeholder="••••••••"
                value={form.api_key_masked} onChange={e => set('api_key_masked', e.target.value)}
                autoComplete="new-password"/>
            </div>

            <div style={{display:'flex', gap:'1rem'}}>
              <div className="admin-form-group" style={{flex:1}}>
                <label className="admin-form-label">API Type</label>
                <select style={selectStyle} value={form.api_type}
                  onChange={e => set('api_type', e.target.value)}>
                  <option value="REST">REST</option>
                  <option value="WebSocket">WebSocket</option>
                  <option value="GraphQL">GraphQL</option>
                </select>
              </div>
              <div className="admin-form-group" style={{flex:1}}>
                <label className="admin-form-label">Status</label>
                <select style={selectStyle} value={form.status}
                  onChange={e => set('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Description</label>
              <input className="admin-form-input" type="text"
                placeholder="e.g. Historical OHLCV data for ML training"
                value={form.description} onChange={e => set('description', e.target.value)}/>
            </div>

            <div style={{display:'flex', gap:'1rem', alignItems:'flex-end'}}>
              <div className="admin-form-group" style={{flex:1, marginBottom:0}}>
                <label className="admin-form-label">Rate Limit (req/min)</label>
                <input className="admin-form-input" type="text" placeholder="e.g. 60"
                  value={form.rate_limit} onChange={e => set('rate_limit', e.target.value)}/>
              </div>
              <div className="admin-form-group" style={{marginBottom:0}}>
                <label style={{display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer',
                  fontSize:'0.875rem', color:'var(--text-muted)', paddingBottom:'0.55rem'}}>
                  <input type="checkbox" checked={form.is_enable}
                    onChange={e => set('is_enable', e.target.checked)}
                    style={{accentColor:'var(--accent)'}}/>
                  Active
                </label>
              </div>
            </div>
          </div>

          <div className="admin-modal-footer">
            <button type="button" className="btn-admin btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-admin btn-primary" disabled={loading}>
              {loading ? <><span className="admin-spinner"/> Adding…</> : 'Add API Source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddAPIModal
