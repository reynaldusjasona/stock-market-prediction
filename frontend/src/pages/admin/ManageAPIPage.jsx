import {useEffect, useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/api'
import ViewAPIModal from './ViewAPIModal'
import AddAPIModal from './AddAPIModal'
import EditAPIModal from './EditAPIModal'
import '../../styles/admin/adminShared.css'

function ManageAPIPage(){
  const[apis,setApis]= useState([])
  const[loading,setLoading]= useState(true)
  const[viewTarget,setViewTarget]= useState(null)
  const[showAdd,setShowAdd]= useState(false)
  const[editTarget,setEditTarget]= useState(null)

  const load=async()=>{
    setLoading(true)
    try{
      const d= await adminApi.getAllApis()
      setApis(Array.isArray(d) ? d : (d?.apis || []))
    } 
	catch (err){
		showToast(err.message || 'Failed to load APIs', 'error') 
	}
    finally{
		setLoading(false) 
	}
  }

  useEffect(()=>{load()}, [])

  return(
    <div>
      <div className="admin-page-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'1rem'}}>
        <div>
          <h1 className="admin-page-title">Manage API Sources</h1>
          <p className="admin-page-sub">View, add, edit and remove external data integrations and rate limits.</p>
        </div>
        <button className="btn-admin btn-primary" onClick={()=>setShowAdd(true)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Add API Source
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Registered Sources</h2>
          <span style={{fontSize:'0.78rem', color:'var(--text-muted)'}}>{apis.length} source{apis.length!==1?'s':''}</span>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table" aria-label="API sources">
            <thead>
              <tr><th>Name</th><th>Base URL</th><th>Purpose</th><th>Rate Limit</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{textAlign:'center', padding:'2.5rem'}}><span className="admin-spinner"/></td></tr>
              ) : !apis.length ? (
                <tr><td colSpan="6"><div className="admin-empty"><p>No API sources configured. Add one to get started.</p></div></td></tr>
              ) : apis.map(a=>(
                <tr key={a.id} style={{cursor:'pointer'}} onClick={()=>setViewTarget(a)}>
                  <td><div style={{fontWeight:600, fontSize:'0.875rem'}}>{a.name||'—'}</div></td>
                  <td style={{fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--text-muted)', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={a.base_url||a.url}>
                    {a.base_url||a.url||'—'}
                  </td>
                  <td style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{a.purpose||a.description||'—'}</td>
                  <td style={{fontFamily:'var(--font-mono)', fontSize:'0.8rem'}}>
                    {a.rate_limit != null ? `${a.rate_limit} req/min` : '—'}
                  </td>
                  <td>
                    <span className={`status-badge ${a.is_active!==false?'status-active':'status-suspended'}`}>
                      {a.is_active!==false?'Active':'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-cell" onClick={e=> e.stopPropagation()}>
                      <button className="icon-btn" title="Edit" onClick={()=> setEditTarget(a)}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M1 10.5V13h2.5l7-7L8 3.5l-7 7zM11.5 2l.5.5-1 1L10.5 3l1-1z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewTarget && <ViewAPIModal target={viewTarget} onClose={()=> setViewTarget(null)} onEdit={t=>{setViewTarget(null); setEditTarget(t)}}/>}
      {showAdd && <AddAPIModal onClose={()=> setShowAdd(false)} onDone={load}/>}
      {editTarget && <EditAPIModal target={editTarget} onClose={()=> setEditTarget(null)} onDone={load}/>}
    </div>
  )
}

export default ManageAPIPage
