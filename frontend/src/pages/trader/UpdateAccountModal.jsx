import {useState} from 'react'
import {api} from '../../api/api'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'
import '../../styles/trader/traderShared.css'

const SPECIALIZATIONS = [
  'Equities', 'Fixed Income', 'Derivatives', 'Commodities',
  'Forex', 'Cryptocurrency', 'ETFs', 'Portfolio Management', 'Technical Analysis'
]

function readUser(){
  try{ 
	return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('sw_user') || '{}') 
	}
  catch{ 
    return {} 
    }
}

function UpdateAccountModal({ onClose, onSaved }) {
  const stored = readUser()
  const[name,setName]= useState(stored.name || stored.full_name || '')
  const[email,setEmail]= useState(stored.email || '')
  const[phone,setPhone]= useState(stored.phone || '')
  const[specialization,setSpecialization]  = useState(stored.specialization || '')
  const[yearsExperience,setYearsExperience] = useState(stored.years_experience || '')
  const[bio,setBio]= useState(stored.bio || '')
  const[oldPw,setOldPw]= useState('')
  const[newPw,setNewPw]= useState('')
  const[busy,setBusy]= useState(false)

  const handleSave = async ()=> {
    if (!name.trim() || !email.trim()){ 
		showToast('Name and email are required', 'error'); 
		return 
	}
    setBusy(true)
    try{
      if (stored.id) {
        const payload = {
          name: name.trim(), email: email.trim(),
          phone: phone.trim(), specialization,
          years_experience: yearsExperience ? Number(yearsExperience) : null,
          bio: bio.trim(),
        }
        await api.patch(`/auth/user/${stored.id}`, payload)
        const updated = { ...stored, ...payload }
        if (localStorage.getItem('user')) localStorage.setItem('user', JSON.stringify(updated))
        if (sessionStorage.getItem('sw_user')) sessionStorage.setItem('sw_user', JSON.stringify(updated))
      }
      if (oldPw && newPw) {
        await api.post('/auth/reset-password', { old_password: oldPw, new_password: newPw })
      }
      showToast('Account updated', 'success')
      onSaved?.()
    } 
	catch (err) {
      showToast(err.message || 'Failed to update account', 'error')
    } 
	finally { 
	  setBusy(false) 
	}
  }

  return(
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
          {/* Basic info */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem' }}>
            <div className="admin-form-group" style={{ marginBottom:0 }}>
              <label className="admin-form-label" htmlFor="uaName">Name *</label>
              <input className="admin-form-input" id="uaName" type="text" maxLength={80}
                value={name} onChange={e => setName(e.target.value)}/>
            </div>
            <div className="admin-form-group" style={{ marginBottom:0 }}>
              <label className="admin-form-label" htmlFor="uaEmail">Email *</label>
              <input className="admin-form-input" id="uaEmail" type="email" maxLength={120}
                value={email} onChange={e => setEmail(e.target.value)}/>
            </div>
            <div className="admin-form-group" style={{ marginBottom:0 }}>
              <label className="admin-form-label" htmlFor="uaPhone">Phone</label>
              <input className="admin-form-input" id="uaPhone" type="tel" maxLength={20}
                placeholder="+65 9123 4567"
                value={phone} onChange={e => setPhone(e.target.value)}/>
            </div>
            <div className="admin-form-group" style={{ marginBottom:0 }}>
              <label className="admin-form-label" htmlFor="uaExp">Years of Experience</label>
              <input className="admin-form-input" id="uaExp" type="number" min={0} max={50}
                placeholder="e.g. 5"
                value={yearsExperience} onChange={e => setYearsExperience(e.target.value)}/>
            </div>
            <div className="admin-form-group" style={{ marginBottom:0, gridColumn:'1/-1' }}>
              <label className="admin-form-label" htmlFor="uaSpec">Specialization</label>
              <select className="admin-form-input" id="uaSpec"
                value={specialization} onChange={e => setSpecialization(e.target.value)}>
                <option value="">Select specialization…</option>
                {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="admin-form-group" style={{ marginBottom:0, gridColumn:'1/-1' }}>
              <label className="admin-form-label" htmlFor="uaBio">Bio</label>
              <textarea className="admin-form-textarea" id="uaBio" maxLength={300}
                placeholder="Brief professional introduction shown to investors…"
                style={{ minHeight:'80px' }}
                value={bio} onChange={e => setBio(e.target.value)}/>
              <div style={{ textAlign:'right', fontSize:'0.7rem', color:'var(--text-subtle)', marginTop:'0.2rem' }}>
                {bio.length} / 300
              </div>
            </div>
          </div>

          {/* Read-only license number */}
          <div style={{ margin:'1rem 0', padding:'0.7rem 1rem', background:'var(--bg)',
            border:'1px solid var(--border)', borderRadius:'8px', fontSize:'0.82rem' }}>
            <span style={{ color:'var(--text-muted)' }}>License Number: </span>
            <span style={{ fontFamily:'var(--font-mono)' }}>{stored.license_number || '—'}</span>
            <span style={{ color:'var(--text-subtle)', marginLeft:'0.5rem', fontSize:'0.72rem' }}>
              (verified — contact support to change)
            </span>
          </div>

          {/* Change password */}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:'1rem' }}>
            <div style={{ fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.06em',
              textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'0.7rem' }}>
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
