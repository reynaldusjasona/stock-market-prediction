import {useEffect, useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import ViewPredictionQualityPanel from './ViewPredictionQualityPanel'
import RetrainModelPanel         from './RetrainModelPanel'
import '../../styles/admin/adminShared.css'

const pct=v=>v != null ? (v*(v<=1?100:1)).toFixed(1)+'%' : '—'
const accColor=(v, cfg = {good_threshold:75, moderate_threshold:60})=>{
  if (v==null) 
	  return 'var(--text)'
  const n=v*(v<=1?100:1)
  return n >= cfg.good_threshold ? '#00ff41' : n >= cfg.moderate_threshold ? '#ffd600' : '#ff4444'
}
const fmtTime= ts=>{ if(!ts)
						return'—'; 
					try{
						return new Date(ts).toLocaleString('en-SG',{dateStyle:'medium',timeStyle:'short'})
						}
					catch{
						return'—'
						} 
					}

function ViewModelPerformancePage(){
  const[perf,setPerf]= useState(null)
  const[loading,setLoading]= useState(true)
  const[subTab,setSubTab]= useState('quality')
  const[config,setConfig]= useState({good_threshold:75, moderate_threshold:60})

  useEffect(()=>{
    adminApi.getModelConfig()
      .then(c => setConfig(p=>({...p, ...c })))
      .catch(()=>{})
  }, [])

  useEffect(()=>{
    adminApi.getModelPerformance()
      .then(setPerf)
      .catch(err=>showToast(err.message||'Failed to load model data', 'error'))
      .finally(()=>setLoading(false))
  }, [])

  const reload =()=>{
    setLoading(true)
    adminApi.getModelPerformance().then(setPerf).finally(()=>setLoading(false))
  }

  const metrics=[
    {label:'Accuracy',val: pct(perf?.accuracy),color: accColor(perf?.accuracy, config)},
    {label:'Precision',val: pct(perf?.precision),color: ''},
    {label:'Recall',val: pct(perf?.recall),color: ''},
    {label:'F1 Score',val: pct(perf?.f1_score),color: ''},
    {label:'MAE',val: perf?.mae  != null ? perf.mae.toFixed(4): '—', color: ''},
    {label:'RMSE',val: perf?.rmse != null ? perf.rmse.toFixed(4): '—', color: ''},
  ]

  return(
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Model Performance</h1>
        <p className="admin-page-sub">Monitor prediction quality and trigger retraining when accuracy degrades.</p>
      </div>

      {/* Metric stat cards */}
      <div className="admin-stats-row">
        {metrics.map(m => (
          <div key={m.label} className="admin-stat-card">
            <div className="admin-stat-label">{m.label}</div>
            <div className="admin-stat-value" style={{ fontSize:'1.45rem', color: m.color || 'var(--text)' }}>
              {loading ? <span className="admin-spinner"/> : m.val}
            </div>
          </div>
        ))}
      </div>

      {/* Meta row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', marginBottom:'1.5rem' }}>
        {[
          { label:'Last Trained',     val: fmtTime(perf?.last_trained_at) },
          { label:'Training Samples', val: perf?.training_samples?.toLocaleString() },
          { label:'Model Version',    val: perf?.model_version },
        ].map(c => (
          <div key={c.label} className="admin-card" style={{ padding:'1rem 1.35rem' }}>
            <div className="admin-stat-label">{c.label}</div>
            <div style={{ fontWeight:600, marginTop:'0.3rem', fontSize:'0.9rem' }}>
              {loading ? <span className="admin-spinner"/> : (c.val || '—')}
            </div>
          </div>
        ))}
      </div>

      {/* Sub-tab navigation */}
      <div className="admin-subtabs" style={{ marginBottom:'1.25rem', display:'inline-flex' }}>
        <button className={`admin-subtab${subTab==='quality' ?' active':''}`} onClick={() => setSubTab('quality')}>
          Prediction Quality
        </button>
        <button className={`admin-subtab${subTab==='retrain'?' active':''}`} onClick={() => setSubTab('retrain')}>
          Retrain Model
        </button>
      </div>

      {subTab==='quality' && <ViewPredictionQualityPanel history={perf?.history || []} loading={loading}/>}
      {subTab==='retrain' && <RetrainModelPanel onRetrainDone={reload}/>}
    </div>
  )
}

export default ViewModelPerformancePage
