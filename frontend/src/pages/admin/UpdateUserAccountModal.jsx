import {useState, useEffect} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

function UpdateUserAccountModal({target, onClose, onDone}){
  const[form,setForm]= useState({name:'', email:''})
  const[loading,setLoading]= useState(false)
  const[fetching,setFetching]= useState(true)
  const[alert,setAlert]= useState({msg:'', type:''})

  useEffect(()=>{
    if (target.user){
      setForm({name: target.user.name||target.user.full_name||'', email: target.user.email||''})
      setFetching(false)
    } 
	else{
      adminApi.getUserById(target.id)
        .then(u=>setForm({name: u.name||u.full_name||'', email: u.email||''}))
        .catch(()=>setAlert({msg:'Could not load user data.', type:'error'}))
        .finally(()=>setFetching(false))
    }
  },[target.id])

  const handleSubmit=async(e)=>{
    e.preventDefault()
    setAlert({msg:'', type:''})
    if (!form.name.trim()||!form.email.trim()){
      setAlert({msg:'Name and email are required.', type:'error'}); 
	  return
    }
    setLoading(true)
    try{
      await adminApi.updateUser(target.id,{name: form.name.trim(),email: form.email.trim()})
      showToast('User account updated successfully', 'success')
      onDone?.()
      onClose?.()
    } 
	catch (err){
      setAlert({msg: err.message||'Failed to update account.', type:'error'})
    } 
	finally{
	  setLoading(false) 
	}
  }

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Edit User Account</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            {alert.msg && <div className={`admin-alert ${alert.type}`}>{alert.msg}</div>}
            {fetching
              ? <div style={{ textAlign:'center', padding:'1.5rem' }}><span className="admin-spinner"/></div>
              : <>
                  <div className="admin-form-group">
                    <label className="admin-form-label" htmlFor="uuName">Full Name</label>
                    <input className="admin-form-input" id="uuName" type="text"
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required/>
                  </div>
                  <div className="admin-form-group" style={{ marginBottom:0 }}>
                    <label className="admin-form-label" htmlFor="uuEmail">Email Address</label>
                    <input className="admin-form-input" id="uuEmail" type="email"
                      value={form.email} onChange={e=>setForm(f =>({ ...f, email: e.target.value }))} required/>
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
