import {useEffect, useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import SearchUsersComponent from './SearchUsersComponent'
import ViewUserAccountModal from './ViewUserAccountModal'
import UpdateUserAccountModal from './UpdateUserAccountModal'
import SuspendUserAccountModal from './SuspendUserAccountModal'
import DeleteUserAccountModal from './DeleteUserAccountModal'
import '../../styles/admin/adminShared.css'

const PAGE= 15
const AVT=['#2563eb','#7c3aed','#0891b2','#0d9488','#d97706','#dc2626','#9333ea','#16a34a']
const avatarColor=s => {let h=0; 
						for(const c of(s||''))
							h=(h*31+c.charCodeAt(0))%AVT.length; 
						return AVT[h] 
						}
const initials=s=> (s||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)

function ManageUserAccountsPage(){
  const[users,setUsers]= useState([])
  const[loading,setLoading]= useState(true)
  const[filter,setFilter]= useState('all')
  const[page,setPage]= useState(1)
  const[viewTarget,setViewTarget]= useState(null)
  const[editTarget,setEditTarget]= useState(null)
  const[suspendTarget,setSuspendTarget]= useState(null)
  const[deleteTarget,setDeleteTarget]= useState(null)

  const loadUsers=async(q = '')=>{
    setLoading(true)
    try{
      const d=await adminApi.getAllUsers(q ? { q } : {})
      setUsers(Array.isArray(d) ? d : (d?.users || []))
    } 
	catch (err){
      showToast(err.message || 'Failed to load users', 'error')
      setUsers([])
    } 
	finally{ 
	  setLoading(false) 
	}
  }

  useEffect(()=>{loadUsers()},[])

  const filtered= users.filter(u=>{
    if (filter==='active')    
		return !u.is_suspended && u.status !== 'suspended'
    if (filter==='suspended') 
		return  u.is_suspended || u.status === 'suspended'
    return true
  })
  const totalPages= Math.ceil(filtered.length / PAGE)
  const paged= filtered.slice((page - 1) * PAGE, page * PAGE)
  const afterAction=()=> loadUsers()

  return(
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Manage User Accounts</h1>
        <p className="admin-page-sub">View, search, update, suspend and delete platform accounts.</p>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <SearchUsersComponent onSearch={q => { setPage(1); loadUsers(q) }}/>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
            <div className="admin-subtabs">
              {['all','active','suspended'].map(f => (
                <button key={f} className={`admin-subtab${filter===f?' active':''}`}
                  onClick={()=>{setFilter(f); setPage(1) }}>
                  {f.charAt(0).toUpperCase()+f.slice(1)}
                </button>
              ))}
            </div>
            <span style={{fontSize:'0.78rem', color:'var(--text-muted)'}}>
              {filtered.length} user{filtered.length!==1?'s':''}
            </span>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table" aria-label="User accounts">
            <thead><tr><th>User</th><th>Subscription</th><th>Expires</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign:'center', padding:'2.5rem' }}><span className="admin-spinner"/></td></tr>
              ) : !paged.length ? (
                <tr><td colSpan="6"><div className="admin-empty"><p>No users found.</p></div></td></tr>
              ) : paged.map(u => {
                const suspended= u.is_suspended || u.status === 'suspended'
                const subStatus= u.subscription_status || 'expired'
                const expiry= u.subscription_expires_at
                const expired= subStatus === 'expired' || (expiry && new Date(expiry) < new Date())
                const subColor= expired ? '#ff4444' : '#00ff41'
                return(
                  <tr key={u.id||u.user_id} style={{ cursor:'pointer' }}
                    onClick={() => setViewTarget({ id: u.id||u.user_id, user: u })}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.65rem' }}>
                        <div style={{ width:'32px', height:'32px', borderRadius:'50%',
                          background:avatarColor(u.name||u.email), display:'flex',
                          alignItems:'center', justifyContent:'center',
                          fontSize:'0.72rem', fontWeight:'700', color:'#000', flexShrink:0 }}>
                          {initials(u.name||u.email)}
                        </div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{u.name||u.full_name||'—'}</div>
                          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{u.email||'—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{fontSize:'0.78rem', fontWeight:600, color:subColor, textTransform:'capitalize'}}>
                        {expired ? 'Expired' : 'Active'}
                      </span>
                    </td>
                    <td style={{fontSize:'0.8rem', color: expired ? '#ff4444' : 'var(--text-muted)'}}>
                      {expiry ? new Date(expiry).toLocaleDateString('en-SG') : '—'}
                    </td>
                    <td><span className={`status-badge ${suspended?'status-suspended':'status-active'}`}>{suspended?'Suspended':'Active'}</span></td>
                    <td style={{color:'var(--text-muted)', fontSize:'0.8rem' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-SG') : '—'}
                    </td>
                    <td>
                      <div className="action-cell" onClick={e => e.stopPropagation()}>
                        <button className="icon-btn" title="Edit"
                          onClick={()=>setEditTarget({id:u.id||u.user_id, user:u})}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 10.5V13h2.5l7-7L8 3.5l-7 7zM11.5 2l.5.5-1 1L10.5 3l1-1z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        <button className="icon-btn warn" title={suspended?'Unsuspend':'Suspend'}
                          onClick={()=>setSuspendTarget({id:u.id||u.user_id, name:u.name||u.email||'User', isSuspended:suspended})}>
                          {suspended
                            ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.1"/><path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.1"/><path d="M5 5v4M9 5v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                          }
                        </button>
                        <button className="icon-btn danger" title="Delete"
                          onClick={()=>setDeleteTarget({id:u.id||u.user_id, name:u.name||u.email||'User'})}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M3 3.5l.7 8a.5.5 0 00.5.5h5.6a.5.5 0 00.5-.5L11 3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="admin-pagination">
            <span style={{ marginRight:'0.5rem' }}>{(page-1)*PAGE+1}–{Math.min(page*PAGE,filtered.length)} of {filtered.length}</span>
            <button disabled={page===1} onClick={() => setPage(p=>p-1)}>‹</button>
            {Array.from({length:totalPages},(_,i)=>i+1).filter(i=>i===1||i===totalPages||Math.abs(i-page)<=1).map((i,idx,arr)=>(
              <span key={i} style={{display:'contents'}}>
                {idx>0&&arr[idx-1]!==i-1&&<span style={{padding:'0 0.2rem',color:'var(--text-subtle)'}}>…</span>}
                <button className={i===page?'active':''} onClick={()=>setPage(i)}>{i}</button>
              </span>
            ))}
            <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>›</button>
          </div>
        )}
      </div>

      {viewTarget && <ViewUserAccountModal target={viewTarget} onClose={()=>setViewTarget(null)} onEdit={setEditTarget} onSuspend={setSuspendTarget} onDelete={setDeleteTarget}/>}
      {editTarget && <UpdateUserAccountModal target={editTarget} onClose={()=>setEditTarget(null)} onDone={afterAction}/>}
      {suspendTarget && <SuspendUserAccountModal target={suspendTarget} onClose={()=>setSuspendTarget(null)} onDone={afterAction}/>}
      {deleteTarget && <DeleteUserAccountModal target={deleteTarget} onClose={()=>setDeleteTarget(null)} onDone={afterAction}/>}
    </div>
  )
}

export default ManageUserAccountsPage
