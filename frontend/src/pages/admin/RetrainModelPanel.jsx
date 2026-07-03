import {useEffect,useState,useRef} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/api'
import '../../styles/admin/adminShared.css'

const today= new Date().toISOString().split('T')[0]

function RetrainModelPanel({ onRetrainDone }){
  const[startDate,setStartDate]= useState('2020-01-01')
  const[endDate,setEndDate]= useState(today)
  const[jobStatus,setJobStatus]= useState(null)
  const[jobId,setJobId]= useState(null)
  const[loading,setLoading]= useState(false)
  const[alert,setAlert]= useState({ msg:'', type:'' })
  const pollRef= useRef(null)

  useEffect(()=>{
    adminApi.getRetrainStatus()
      .then(r =>{
        if (r?.status ==='running'||r?.status === 'pending'){
          setJobStatus(r.status); 
		  setJobId(r.job_id||null)
          setLoading(true); startPolling()
        } 
		else if(r?.status==='completed'){
          setJobStatus('completed'); 
		  setJobId(r.job_id || null)
        }
      })
      .catch(()=>{})
    return()=>clearInterval(pollRef.current)
  }, [])

  const handleRetrain = async()=>{
    setAlert({msg:'', type:''})
    if (!startDate || !endDate){ 
		setAlert({ msg:'Please set both dates.', type:'error' }); 
		return 
		}
    if (new Date(startDate) >= new Date(endDate)){ 
		setAlert({ msg:'Start must be before end date.', type:'error' }); 
		return 
		}
    setLoading(true)
    try{
      const r = await adminApi.retrainModel({start_date: startDate, end_date: endDate})
      setJobId(r?.job_id || null); setJobStatus('running')
      showToast('Retraining job started', 'success')
      startPolling()
    } 
	catch (err){
      setAlert({msg: err.message || 'Failed to start retraining.', type:'error'})
      setLoading(false)
    }
  }

  const startPolling=()=>{
    clearInterval(pollRef.current)
    pollRef.current= setInterval(async()=>{
      try{
        const r= await adminApi.getRetrainStatus()
        setJobStatus(r?.status)
        if (r?.status==='completed'){
          clearInterval(pollRef.current); 
		  setLoading(false)
          showToast('Retraining completed!', 'success')
          setAlert({ msg:'New model is now active.', type:'success' })
          onRetrainDone?.()
        } 
		else if (r?.status === 'failed'){
          clearInterval(pollRef.current); 
		  setLoading(false)
          setAlert({ msg:'Retraining failed. Check backend logs.', type:'error' })
        }
      } 
	  catch { 
	  clearInterval(pollRef.current); 
	  setLoading(false) 
	  }
    }, 6000)
  }

  const SC ={
    pending:{color:'#60a5fa', label:'Job queued — waiting to start…'},
    running:{color:'#ffd600', label:'Retraining in progress — polling every 6s…'},
    completed:{color:'#00ff41', label:'Retraining completed successfully.'},
    failed:{color:'#ff4444', label:'Retraining failed. Check backend logs.'},
  }
  const sc= jobStatus ? SC[jobStatus] : null

  return(
    <div className="admin-card">
      <div className="admin-card-header">
        <h2 className="admin-card-title">Retrain Model</h2>
        {jobId && <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>Job: {jobId}</span>}
      </div>

      <div className="admin-card-body">
        <p style={{ margin:'0 0 1.25rem', fontSize:'0.875rem', color:'var(--text-muted)', lineHeight:1.65 }}>
          Trigger full retraining using yfinance OHLCV data. Only retrain if accuracy has degraded — the job is resource-intensive and runs asynchronously.
        </p>

        {sc && (
          <div className="admin-alert" style={{ background:`${sc.color}10`, borderColor:`${sc.color}30`, color:sc.color, marginBottom:'1.25rem' }}>
            <span>{sc.label}</span>
          </div>
        )}

        {alert.msg && <div className={`admin-alert ${alert.type}`}>{alert.msg}</div>}

        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
          <div className="admin-form-group" style={{ flex:1, minWidth:'160px', margin:0 }}>
            <label className="admin-form-label" htmlFor="tsStart">Training Start Date</label>
            <input className="admin-form-input" id="tsStart" type="date"
              value={startDate} onChange={e => setStartDate(e.target.value)} disabled={loading}/>
          </div>
          <div className="admin-form-group" style={{ flex:1, minWidth:'160px', margin:0 }}>
            <label className="admin-form-label" htmlFor="tsEnd">Training End Date</label>
            <input className="admin-form-input" id="tsEnd" type="date"
              value={endDate} onChange={e => setEndDate(e.target.value)} max={today} disabled={loading}/>
          </div>
        </div>

        <button className="btn-admin btn-primary" onClick={handleRetrain} disabled={loading}>
          {loading
            ? <><span className="admin-spinner"/> {jobStatus==='running' ? 'Training in progress…' : 'Starting…'}</>
            : 'Retrain Model Now'
          }
        </button>
      </div>
    </div>
  )
}

export default RetrainModelPanel
