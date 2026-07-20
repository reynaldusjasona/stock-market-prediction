import {useState} from 'react'
import {api} from '../../api/api'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

function readUser() {
  try{ 
	return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('sw_user') || '{}') 
	}
  catch{ 
	return {} 
	}
}

function UpdateAccountModal({ onClose, onSaved }) {
  const stored = readUser()
  const[name,  setName]= useState(stored.name || stored.full_name || '')
  const[email, setEmail]= useState(stored.email || '')
  const[oldPw, setOldPw]= useState('')
  const[newPw, setNewPw]= useState('')
  const[busy,  setBusy]= useState(false)

  const handleSave = async()=> {
    if (!name.trim() || !email.trim()){ 
		showToast('Name and email are required', 'error'); 
		return 
	}
    setBusy(true)
    try{
      if (stored.id) {
        await api.patch(`/auth/user/${stored.id}`, { name: name.trim(), email: email.trim() })
        const updated = { ...stored, name: name.trim(), email: email.trim() }
        if (localStorage.getItem('user')) localStorage.setItem('user', JSON.stringify(updated))
        if (sessionStorage.getItem('sw_user')) sessionStorage.setItem('sw_user', JSON.stringify(updated))
      }
      if (oldPw && newPw) {
        await api.post('/auth/reset-password', { old_password: oldPw, new_password: newPw })
      }
      showToast('Account updated', 'success')
      onSaved?.()
    } catch (err) {
      showToast(err.message || 'Failed to update account', 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Edit My Account</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="admin-modal-body">
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="uaName">Name</label>
            <input className="admin-form-input" id="uaName" type="text" maxLength={80}
              value={name} onChange={e => setName(e.target.value)}/>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="uaEmail">Email</label>
            <input className="admin-form-input" id="uaEmail" type="email" maxLength={120}
              value={email} onChange={e => setEmail(e.target.value)}/>
          </div>

          <div style={{ borderTop:'1px solid var(--border)', paddingTop:'1rem' }}>
            <div style={{ fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
              color:'var(--text-muted)', marginBottom:'0.7rem' }}>
              Change Password (optional)
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem' }}>
              <div className="admin-form-group" style={{ marginBottom:0 }}>
                <label className="admin-form-label" htmlFor="uaOldPw">Current Password</label>
                <input className="admin-form-input" id="uaOldPw" type="password"
                  value={oldPw} onChange={e => setOldPw(e.target.value)}/>
              </div>
              <div className="admin-form-group" style={{ marginBottom:0 }}>
                <label className="admin-form-label" htmlFor="uaNewPw">New Password</label>
                <input className="admin-form-input" id="uaNewPw" type="password"
                  value={newPw} onChange={e => setNewPw(e.target.value)}/>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-modal-footer">
          <button className="btn-admin btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-admin btn-primary" onClick={handleSave} disabled={busy}>
            {busy ? <><span className="admin-spinner"/> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UpdateAccountModal
