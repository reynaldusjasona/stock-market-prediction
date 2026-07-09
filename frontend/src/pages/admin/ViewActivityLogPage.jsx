import {useEffect, useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/api'
import SearchActivityLogComponent from './SearchActivityLogComponent'
import '../../styles/admin/adminShared.css'

const PAGE = 20

const ACTION_COLOR={
  login:'#00ff41',
  logout:'#60a5fa',
  suspend_user:'#ff8c00',
  unsuspend_user:'#00ff41',
  delete_user:'#ff4444',
  update_user:'#60a5fa',
  approve_feedback:'#00ff41',
  reject_feedback:'#ff4444',
  retrain_model:'#a78bfa',
  update_landing:'#fb923c',
  add_api:'#34d399',
  edit_api:'#60a5fa',
  delete_api:'#ff4444',
  dismiss_alert:'#00ff41',
  reset_password:'#ffd600',
}

const fmtAction=a=> a?.replace(/_/g, ' ') || '—'

function ViewActivityLogPage(){
  const[logs,setLogs]= useState([])
  const[loading,setLoading]= useState(true)
  const[searchQuery,setSearchQuery]= useState('')
  const[filterAction,setFilterAction]= useState('all')
  const[page,setPage]= useState(1)

  const load=async (q = '')=>{
    setLoading(true)
    try{
      const d= await adminApi.getActivityLog(q ? { q } : {})
      setLogs(Array.isArray(d) ? d : (d?.logs || []))
    } 
	catch (err){
      showToast(err.message || 'Failed to load activity log', 'error')
      setLogs([])
    } 
	finally{ 
	  setLoading(false) 
	 }
  }

  useEffect(()=>{load()}, [])

  const handleSearch=(q)=>{setSearchQuery(q); setPage(1); load(q) }

  const actionTypes= ['all', ...new Set(logs.map(l => l.action).filter(Boolean))]

  const filtered= logs.filter(l => filterAction === 'all' || l.action === filterAction)
  const totalPages= Math.ceil(filtered.length / PAGE)
  const paged= filtered.slice((page - 1) * PAGE, page * PAGE)

  return(
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Activity Log</h1>
        <p className="admin-page-sub">A record of all administrator actions for accountability and auditing.</p>
      </div>

      <div className="admin-card">
        <div className="admin-card-header" style={{ flexDirection:'column', alignItems:'flex-start', gap:'0.75rem' }}>
          <div style={{ display:'flex', width:'100%', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.75rem' }}>
            <SearchActivityLogComponent onSearch={handleSearch} defaultValue={searchQuery}/>
            <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
              {filtered.length} event{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Action filter dropdown */}
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>Filter by action:</label>
            <select
              className="admin-form-select"
              value={filterAction}
              onChange={e => { setFilterAction(e.target.value); setPage(1) }}
              style={{ fontSize:'0.78rem', padding:'0.3rem 0.6rem', height:'auto' }}>
              {actionTypes.map(a => (
                <option key={a} value={a}>{a === 'all' ? 'All Actions' : fmtAction(a)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table" aria-label="Admin activity log">
            <thead>
              <tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign:'center', padding:'2.5rem' }}><span className="admin-spinner"/></td></tr>
              ) : !paged.length ? (
                <tr><td colSpan="5"><div className="admin-empty"><p>No activity log entries found.</p></div></td></tr>
              ) : paged.map((l, i) => (
                <tr key={l.id || i}>
                  <td style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                    {l.created_at ? new Date(l.created_at).toLocaleString('en-SG', { dateStyle:'short', timeStyle:'short' }) : '—'}
                  </td>
                  <td>
                    <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{l.admin_name || '—'}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{l.admin_email || ''}</div>
                  </td>
                  <td>
                    <span style={{
                      fontSize:'0.75rem', fontWeight:600, textTransform:'capitalize',
                      color: ACTION_COLOR[l.action] || 'var(--text-muted)',
                      background: `${ACTION_COLOR[l.action] || '#888'}15`,
                      border: `1px solid ${ACTION_COLOR[l.action] || '#888'}30`,
                      borderRadius:'6px', padding:'0.15rem 0.5rem',
                    }}>
                      {fmtAction(l.action)}
                    </span>
                  </td>
                  <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>
                    <div>{l.target_type || '—'}</div>
                    {l.target_id && <div style={{ fontSize:'0.72rem', fontFamily:'var(--font-mono)' }}>{l.target_id}</div>}
                  </td>
                  <td style={{ fontSize:'0.78rem', color:'var(--text-muted)', maxWidth:'200px' }}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {l.details || '—'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="admin-pagination">
            <span style={{ marginRight:'0.5rem' }}>
              {(page-1)*PAGE+1}–{Math.min(page*PAGE, filtered.length)} of {filtered.length}
            </span>
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
    </div>
  )
}

export default ViewActivityLogPage
