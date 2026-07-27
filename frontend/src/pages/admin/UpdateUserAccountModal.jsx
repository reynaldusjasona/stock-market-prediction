import {useState, useEffect} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

function UpdateUserAccountModal({target, onClose, onDone}){
  const[form,setForm]= useState({name:'', email:'', role:'', status:''})
  const[loading,setLoading]= useState(false)
  const[fetching,setFetching]= useState(true)
  const[alert,setAlert]= useState({msg:'', type:''})

  useEffect(()=>{
    if (target.user){
      setForm({
        name:   target.user.name||target.user.full_name||'',
        email:  target.user.email||'',
        role:   target.user.role||'investor',
        status: target.user.status||'active',
      })
      setFetching(false)
    } else{
      adminApi.getUserById(target.id)
        .then(u=>setForm({
          name:   u.name||u.full_name||'',
          email:  u.email||'',
          role:   u.role||'investor',
          status: u.status||'active',
        }))
        .catch(()=>setAlert({msg:'Could not load user data.', type:'error'}))
        .finally(()=>setFetching(false))
    }
  },[target.id])

  const handleSubmit=async(e)=>{
    e.preventDefault()
    setAlert({msg:'', type:''})
    setLoading(true)
    try{
      await adminApi.updateUser(target.id, { role: form.role, status: form.status })
      showToast('User account updated successfully', 'success')
      onDone?.()
      onClose?.()
    } catch (err){
      setAlert({msg: err.message||'Failed to update account.', type:'error'})
    } finally{ setLoading(false) }
  }

  const selectStyle = {
    width:'100%', padding:'0.55rem 0.85rem', borderRadius:'8px',
    background:'var(--bg)', border:'1px solid var(--border)',
    color:'var(--text)', fontSize:'0.875rem', fontFamily:'var(--font-sans)'
  }

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Edit User Account</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            {alert.msg && <div className={`admin-alert ${alert.type}`}>{alert.msg}</div>}
            {fetching
              ? <div style={{ textAlign:'center', padding:'1.5rem' }}><span className="admin-spinner"/></div>
              : <>
                  {/* Read-only info */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'1.1rem',
                    padding:'0.8rem 1rem', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px' }}>
                    <div>
                      <div className="admin-form-label">Name</div>
                      <div style={{ fontSize:'0.85rem', fontWeight:600 }}>{form.name || '—'}</div>
                    </div>
                    <div>
                      <div className="admin-form-label">Email</div>
                      <div style={{ fontSize:'0.85rem' }}>{form.email || '—'}</div>
                    </div>
                  </div>

                  {/* Editable fields */}
                  <div className="admin-form-group">
                    <label className="admin-form-label" htmlFor="uuRole">Role</label>
                    <select className="admin-form-input" id="uuRole" style={selectStyle}
                      value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="investor">Investor</option>
                      <option value="trader">Trader</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="admin-form-group" style={{ marginBottom:0 }}>
                    <label className="admin-form-label" htmlFor="uuStatus">Status</label>
                    <select className="admin-form-input" id="uuStatus" style={selectStyle}
                      value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </>
            }
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="btn-admin btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-admin btn-primary" disabled={loading || fetching}>
              {loading ? <><span className="admin-spinner"/> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default UpdateUserAccountModal
