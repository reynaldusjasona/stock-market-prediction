import {useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/api'
import '../../styles/admin/adminShared.css'

function SuspendUserAccountModal({target,onClose,onDone}){
  const[reason,setReason]= useState('')
  const[loading,setLoading]= useState(false)
  const[alert,setAlert]= useState({msg:'', type:''})

  const isSuspended= target.isSuspended

  const handleSubmit= async(e)=>{
    e.preventDefault()
    setAlert({msg:'', type:''})
    setLoading(true)
    try{
      if (isSuspended){
        await adminApi.unsuspendUser(target.id)
        showToast(`${target.name} account unsuspended`, 'success')
      } 
	  else {
        await adminApi.suspendUser(target.id, reason)
        showToast(`${target.name} account suspended`, 'success')
      }
      onDone?.()
      onClose?.()
    } 
	catch (err){
      setAlert({ msg: err.message || 'Action failed. Please try again.', type:'error' })
    } finally{ 
		setLoading(false) 
	}
  }

  return(
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-confirm-box" style={{ maxWidth:'460px' }}>
        <div className={`admin-confirm-icon`}
          style={isSuspended
            ? { background:'rgba(0,255,65,0.1)', color:'#00ff41' }
            : { background:'rgba(255,140,0,0.12)', color:'#ff8c00' }}>
          {isSuspended
            ? <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.4"/><path d="M7 11l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.4"/><path d="M8 8v6M14 8v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          }
        </div>

        <h3 className="admin-confirm-title">{isSuspended ? 'Unsuspend Account' : 'Suspend Account'}</h3>
        <p className="admin-confirm-msg">
          {isSuspended
            ? <>Restore access for <strong>{target.name}</strong>? They will be able to log in immediately.</>
            : <>Suspend <strong>{target.name}</strong>? They will lose access until unsuspended.</>
          }
        </p>

        {alert.msg && <div className={`admin-alert ${alert.type}`} style={{ textAlign:'left', marginBottom:'1rem' }}>{alert.msg}</div>}

        <form onSubmit={handleSubmit}>
          {!isSuspended && (
            <div className="admin-form-group" style={{ textAlign:'left', marginBottom:'1.25rem' }}>
              <label className="admin-form-label" htmlFor="suspReason">
                Reason <span style={{ opacity:0.6 }}>(optional)</span>
              </label>
              <textarea className="admin-form-textarea" id="suspReason"
                placeholder="Describe the reason for suspension…"
                value={reason} onChange={e => setReason(e.target.value)}
                style={{ minHeight:'72px' }}/>
            </div>
          )}
          <div className="admin-confirm-btns">
            <button type="button" className="btn-admin btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit"
              className={`btn-admin ${isSuspended ? 'btn-success' : 'btn-warn'}`}
              disabled={loading}>
              {loading
                ? <><span className="admin-spinner"/> {isSuspended ? 'Restoring…' : 'Suspending…'}</>
                : isSuspended ? 'Yes, Unsuspend' : 'Yes, Suspend'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SuspendUserAccountModal
