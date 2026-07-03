import {useEffect, useState} from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts'
import adminApi from '../../js/adminApi'
import '../../styles/admin/adminShared.css'

const DEFAULT_CONFIG={
  good_threshold:75,
  moderate_threshold:60,
  chart_limit:24,
  table_limit:30,
}

const pct= v=>v != null ? (v *(v <= 1 ? 100 : 1)).toFixed(1) + '%' : '—'
const norm= v=>v == null ? null : parseFloat((v*(v <= 1 ? 100 : 1)).toFixed(2))

const colFromConfig=(v, cfg)=>{
  if (v==null) 
	  return 'var(--text-muted)'
  const n=v*(v <= 1 ? 100 : 1)
  return n >= cfg.good_threshold ? '#00ff41' : n >= cfg.moderate_threshold ? '#ffd600' : '#ff4444'
}

const fmtDate=str=>{
  if (!str) 
	  return ''
  try{ 
	return new Date(str).toLocaleDateString('en-SG', { day:'numeric', month:'short' }) 
  }
  catch{ 
	return '' 
  }
}

function CustomTooltip({active, payload, label}){
  if (!active||!payload?.length) 
	  return null
  return(
    <div style={{background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:'8px', padding:'0.75rem 1rem', fontSize:'0.78rem',
      boxShadow:'0 4px 16px rgba(0,0,0,0.4)'}}>
      <div style={{color:'var(--text-muted)', marginBottom:'0.5rem', fontWeight:600}}>{label}</div>
      {payload.map(p=>(
        <div key={p.dataKey} style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.25rem'}}>
          <span style={{width:'8px', height:'8px', borderRadius:'50%', background:p.color, flexShrink:0}}/>
          <span style={{color:'var(--text-muted)', textTransform:'capitalize'}}>{p.dataKey}:</span>
          <span style={{fontWeight:700, color:p.color }}>{p.value != null ? p.value.toFixed(1) + '%' : '—'}</span>
        </div>
      ))}
    </div>
  )
}

function ViewPredictionQualityPage({history: histProp, loading: parentLoading}){
  const[history,setHistory]= useState(histProp||[])
  const[loading,setLoading]= useState(!histProp && parentLoading)
  const[config,setConfig]= useState(DEFAULT_CONFIG)
  const[activeMetrics,setActiveMetrics]= useState({
    accuracy:true,
    precision:false,
    recall:false,
    f1_score:false,
  })

  useEffect(()=>{
    adminApi.getModelConfig()
      .then(c=>setConfig({...DEFAULT_CONFIG, ...c}))
      .catch(()=>{ /* keep defaults if endpoint not yet available */ })
  }, [])

  useEffect(()=>{
    if (histProp){ 
		setHistory(histProp); 
		return 
	}
    adminApi.getModelQuality()
      .then(d=>setHistory(Array.isArray(d) ? d:(d?.history||[])))
      .catch(()=>setHistory([]))
      .finally(()=>setLoading(false))
  }, [histProp])

  const chartData=history.slice(-config.chart_limit).map(h=>({
    date:fmtDate(h.evaluated_at || h.date),
    accuracy:norm(h.accuracy),
    precision:norm(h.precision),
    recall:norm(h.recall),
    f1_score:norm(h.f1_score),
  }))

  const METRICS=[
    {key:'accuracy',label:'Accuracy',color:'#00ff41' },
    {key:'precision',label:'Precision',color:'#60a5fa' },
    {key:'recall',label:'Recall',color:'#f59e0b' },
    {key:'f1_score',label:'F1 Score',color:'#a78bfa' },
  ]

  const latest= history.length ? norm(history[history.length - 1]?.accuracy) : null
  const latestCol= latest != null ? colFromConfig(latest / 100, config) : 'var(--text-muted)'
  const yMin= Math.max(0,Math.min(...chartData.map(d => d.accuracy || 100)) - 10)

  return(
    <div className="admin-card">
      <div className="admin-card-header">
        <h2 className="admin-card-title">Prediction Quality History</h2>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          {latest != null && (
            <span style={{
              fontSize:'0.78rem', fontWeight:700, color:latestCol,
              background:`${latestCol}15`, border:`1px solid ${latestCol}30`,
              borderRadius:'6px', padding:'0.2rem 0.6rem'
            }}>
              Latest: {latest.toFixed(1)}%
            </span>
          )}
          <span style={{fontSize:'0.78rem', color:'var(--text-muted)'}}>
            {history.length} evaluation{history.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div style={{padding:'1.25rem 1.5rem'}}>

        {/* Metric toggles */}
        <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1.25rem'}}>
          {METRICS.map(m=>(
            <button key={m.key}
              onClick={()=>setActiveMetrics(p =>({ ...p, [m.key]: !p[m.key]}))}
              style={{
                display:'flex', alignItems:'center', gap:'0.4rem',
                padding:'0.3rem 0.75rem', borderRadius:'20px', cursor:'pointer',
                border:`1px solid ${activeMetrics[m.key] ? m.color : 'var(--border)'}`,
                background: activeMetrics[m.key] ? `${m.color}15` : 'transparent',
                color: activeMetrics[m.key] ? m.color : 'var(--text-muted)',
                fontSize:'0.75rem', fontWeight:600, fontFamily:'var(--font-sans)',
                transition:'all 0.15s',
              }}>
              <span style={{width:'7px', height:'7px', borderRadius:'50%',
                background: activeMetrics[m.key] ? m.color : 'var(--text-subtle)'}}/>
              {m.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        {loading ? (
          <div style={{height:'280px', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <span className="admin-spinner"/>
          </div>
        ) : !chartData.length ? (
          <div style={{height:'280px', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div className="admin-empty"><p>No performance history recorded yet.</p></div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{top:10, right:20, left:0, bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>

              <XAxis
                dataKey="date"
                tick={{fill:'var(--text-muted)', fontSize:11}}
                axisLine={{stroke:'var(--border)'}}
                tickLine={false}
              />

              <YAxis
                domain={[yMin, 100]}
                tickFormatter={v => `${v}%`}
                tick={{fill:'var(--text-muted)', fontSize:11}}
                axisLine={{stroke:'var(--border)'}}
                tickLine={false}
                width={42}
              />

              <Tooltip content={<CustomTooltip/>}/>

              {/* Threshold reference lines — values from backend config */}
              <ReferenceLine
                y={config.good_threshold}
                stroke="#00ff41" strokeDasharray="4 4" strokeOpacity={0.4}
                label={{value:`${config.good_threshold}% Good`, fill:'#00ff41', fontSize:10, opacity:0.7, position:'insideTopRight'}}
              />
              <ReferenceLine
                y={config.moderate_threshold}
                stroke="#ffd600" strokeDasharray="4 4" strokeOpacity={0.4}
                label={{value:`${config.moderate_threshold}% Moderate`, fill:'#ffd600', fontSize:10, opacity:0.7, position:'insideTopRight'}}
              />

              {METRICS.map(m=>activeMetrics[m.key] && (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  stroke={m.color}
                  strokeWidth={m.key==='accuracy' ? 2.5 : 1.5}
                  dot={{r:3, fill:m.color, strokeWidth:0}}
                  activeDot={{r:5, fill:m.color, stroke:'var(--surface)', strokeWidth:2}}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* History table */}
      <div className="admin-table-wrap">
        <table className="admin-table" aria-label="Model performance history">
          <thead>
            <tr><th>Evaluated</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1</th><th>MAE</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign:'center', padding:'2.5rem' }}><span className="admin-spinner"/></td></tr>
            ) : !history.length ? (
              <tr><td colSpan="6"><div className="admin-empty"><p>No performance history recorded yet.</p></div></td></tr>
            ) : history.slice(0, config.table_limit).map((h, i) => (
              <tr key={i}>
                <td style={{color:'var(--text-muted)', fontSize:'0.8rem'}}>
                  {h.evaluated_at || h.date
                    ? new Date(h.evaluated_at||h.date).toLocaleString('en-SG', {dateStyle:'short', timeStyle:'short'})
                    : '—'}
                </td>
                <td style={{fontFamily:'var(--font-mono)', fontWeight:600, color:colFromConfig(h.accuracy, config)}}>{pct(h.accuracy)}</td>
                <td style={{fontFamily:'var(--font-mono)'}}>{pct(h.precision)}</td>
                <td style={{fontFamily:'var(--font-mono)'}}>{pct(h.recall)}</td>
                <td style={{fontFamily:'var(--font-mono)'}}>{pct(h.f1_score)}</td>
                <td style={{fontFamily:'var(--font-mono)'}}>{h.mae != null ? h.mae.toFixed(4) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ViewPredictionQualityPage
