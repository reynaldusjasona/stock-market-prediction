import {useState} from 'react'
import adminApi from '../../js/adminApi'
import '../../styles/admin/adminShared.css'

function ResetPasswordPage({onClose}) {
  const [email,setEmail]= useState('')
  const [loading,setLoading]= useState(false)
  const [alert,setAlert]= useState({msg:'', type:''})

  const handleSubmit = async(e)=>{
    e.preventDefault()
    setAlert({ msg:'', type:'' })
    if (!email.trim()){ 
		setAlert({ msg:'Please enter an email address.', type:'error' }); 
		return 
		}
    setLoading(true)
    try{
      await adminApi.adminResetPassword(email.trim())
      setAlert({ msg:`Reset link sent to ${email}.`, type:'success' })
      setEmail('')
    } 
	catch (err){
      setAlert({ msg: err.message||'Failed to send reset link.', type:'error' })
    } 
	finally { 
	  setLoading(false) 
	}
  }

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Reset User Password</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            <p style={{ margin:'0 0 1.25rem', fontSize:'0.875rem', color:'var(--text-muted)', lineHeight:1.6 }}>
              Enter the user's email address to send them a password reset link.
            </p>
            {alert.msg && <div className={`admin-alert ${alert.type}`}>{alert.msg}</div>}
            <div className="admin-form-group" style={{ marginBottom:0 }}>
              <label className="admin-form-label" htmlFor="rpEmail">User Email Address</label>
              <input className="admin-form-input" id="rpEmail" type="email"
                placeholder="user@example.com" value={email}
                onChange={e => setEmail(e.target.value)} required/>
            </div>
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="btn-admin btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-admin btn-primary" disabled={loading}>
              {loading ? <><span className="admin-spinner"/> Sending…</> : 'Send Reset Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ResetPasswordPage
