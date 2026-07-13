import {useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

function DeleteUserAccountModal({target,onClose,onDone}){
  const[loading, setLoading] = useState(false)

  const handleDelete = async()=>{
    setLoading(true)
    try{
      await adminApi.deleteUser(target.id)
      showToast(`${target.name} deleted successfully`,'success')
      onDone?.()
      onClose?.()
    } 
	catch (err){
      showToast(err.message||'Failed to delete account','error')
    } 
	finally{
	  setLoading(false) 
	}
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="admin-confirm-box">
        <div className="admin-confirm-icon danger">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 5h16M8 5V3.5A.5.5 0 018.5 3h5a.5.5 0 01.5.5V5M5 5l1 14a1 1 0 001 1h8a1 1 0 001-1L17 5"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h3 className="admin-confirm-title">Delete User Account</h3>
        <p className="admin-confirm-msg">
          Permanently delete <strong>{target.name}</strong>?
          This cannot be undone and all associated data will be removed.
        </p>
        <div className="admin-confirm-btns">
          <button className="btn-admin btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-admin btn-danger" onClick={handleDelete} disabled={loading}>
            {loading ? <><span className="admin-spinner"/> Deleting…</> : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteUserAccountModal
