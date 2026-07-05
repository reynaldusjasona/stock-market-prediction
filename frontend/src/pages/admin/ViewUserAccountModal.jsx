import {useState, useEffect} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/api'
import '../../styles/admin/adminShared.css'

const AVT = ['#2563eb','#7c3aed','#0891b2','#0d9488','#d97706','#dc2626','#9333ea','#16a34a']
const avatarColor=s=> {let h=0; 
					   for(const c of(s||''))
						   h=(h*31+c.charCodeAt(0))%AVT.length; 
						   return AVT[h] 
					   }
const initials=s=>(s||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)

function ViewUserAccountModal({target, onClose, onEdit, onSuspend, onDelete}){
  const[user,setUser]= useState(target?.user || null)
  const[loading,setLoading]= useState(!target?.user)

  useEffect(()=>{
    if (target?.user) 
		return
    adminApi.getUserById(target.id)
      .then(setUser)
      .catch(err=>showToast(err.message||'Failed to load user', 'error'))
      .finally(()=>setLoading(false))
  }, [target.id])

  const suspended= user?.is_suspended || user?.status === 'suspended'

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">User Account Detail</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="admin-modal-body">
          {loading ? (
            <div style={{ textAlign:'center', padding:'2rem' }}><span className="admin-spinner"/></div>
          ) : !user ? (
            <div className="admin-empty"><p>User not found.</p></div>
          ) : (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem' }}>
                <div style={{width:'52px', height:'52px', borderRadius:'50%',
                  background:avatarColor(user.name||user.email), display:'flex',
                  alignItems:'center', justifyContent:'center',
                  fontSize:'1rem', fontWeight:700, color:'#000', flexShrink:0}}>
                  {initials(user.name||user.email)}
                </div>
                <div>
                  <div style={{fontWeight:700, fontSize:'1rem', color:'var(--text)'}}>{user.name||user.full_name||'—'}</div>
                  <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{user.email||'—'}</div>
                </div>
                <span className={`status-badge ${suspended?'status-suspended':'status-active'}`} style={{marginLeft:'auto'}}>
                  {suspended ? 'Suspended' : 'Active'}
                </span>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                {[
                  {label:'User ID',val: user.id || user.user_id || '—'},
                  {label:'Account Status',val: suspended ? 'Suspended' : 'Active'},
                  {label:'Joined',val: user.created_at ? new Date(user.created_at).toLocaleDateString('en-SG') : '—'},
                  {label:'Last Login',val: user.last_login  ? new Date(user.last_login).toLocaleString('en-SG')  : '—'},
                  {label:'Subscription',val: user.subscription_status === 'active' ? 'Active' : 'Expired'},
                  {label:'Expires',val: user.subscription_expires_at ? new Date(user.subscription_expires_at).toLocaleDateString('en-SG') : '—'},
                ].map(f=>(
                  <div key={f.label}>
                    <div className="admin-form-label">{f.label}</div>
                    <div style={{fontSize:'0.875rem', color:'var(--text)', marginTop:'0.2rem'}}>{f.val}</div>
                  </div>
                ))}
              </div>

              {suspended && user.suspension_reason && (
                <div style={{marginTop:'1rem'}}>
                  <div className="admin-form-label">Suspension Reason</div>
                  <div style={{fontSize:'0.875rem', color:'var(--text-muted)', marginTop:'0.2rem'}}>{user.suspension_reason}</div>
                </div>
              )}
            </>
          )}
        </div>

        {user && (
          <div className="admin-modal-footer" style={{ justifyContent:'space-between' }}>
            <button className="btn-admin btn-danger"
              onClick={()=>{onClose?.(); 
							onDelete?.({ id:user.id||user.user_id, name:user.name||user.email }) 
							}}>
              Delete
            </button>
            <div style={{display:'flex', gap:'0.75rem'}}>
              <button className="btn-admin btn-warn"
                onClick={()=>{onClose?.(); 
							  onSuspend?.({ id:user.id||user.user_id, name:user.name||user.email, isSuspended:suspended }) 
							  }}>
                {suspended ? 'Unsuspend' : 'Suspend'}
              </button>
              <button className="btn-admin btn-primary"
                onClick={()=>{onClose?.(); 
							  onEdit?.({ id:user.id||user.user_id, user }) 
							 }}>
                Edit Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ViewUserAccountModal
