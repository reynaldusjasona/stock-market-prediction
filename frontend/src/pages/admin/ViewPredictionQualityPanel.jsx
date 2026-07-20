import {useEffect, useState} from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import adminApi from '../../js/adminApi'
import '../../styles/admin/adminShared.css'

const CLASS_ORDER = ['Buy', 'Hold', 'Sell']
const CLASS_COLOR = { Buy:'#00ff41', Hold:'#60a5fa', Sell:'#ff4444' }

const pct = v => v != null ? (v * (v <= 1 ? 100 : 1)).toFixed(1) + '%' : '—'
const f1Color = v => {
  if (v == null) return 'var(--text-muted)'
  const n = v * (v <= 1 ? 100 : 1)
  return n >= 75 ? '#00ff41' : n >= 60 ? '#ffd600' : '#ff4444'
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:'8px', padding:'0.75rem 1rem', fontSize:'0.78rem',
      boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
      <div style={{ color:'var(--text)', fontWeight:700, marginBottom:'0.4rem' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display:'flex', gap:'0.5rem', marginBottom:'0.2rem' }}>
          <span style={{ width:'8px', height:'8px', borderRadius:'2px', background:p.fill, flexShrink:0, marginTop:'3px' }}/>
          <span style={{ color:'var(--text-muted)' }}>{p.name}:</span>
          <span style={{ fontWeight:700, color:'var(--text)' }}>{(p.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

function ViewPredictionQualityPanel() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getModelQuality()
      .then(d => {
        const rows = Array.isArray(d) ? d : (d?.classes || d?.metrics || [])
        const latest = {}
        rows.forEach(r => {
          const k = r.class_name
          if (!k) return
          if (!latest[k] || new Date(r.updated_at || 0) > new Date(latest[k].updated_at || 0)) {
            latest[k] = r
          }
        })
        const ordered = CLASS_ORDER.filter(c => latest[c]).map(c => latest[c])
        // Include any unexpected class names at the end
        Object.values(latest).forEach(r => { if (!CLASS_ORDER.includes(r.class_name)) ordered.push(r) })
        setClasses(ordered)
      })
      .catch(() => setClasses([]))
      .finally(() => setLoading(false))
  }, [])

  const chartData = classes.map(c => ({
    class:c.class_name,
    Precision:c.precision_score ?? null,
    Recall:c.recall_score ?? null,
    'F1 Score':c.f1_score ?? null,
  }))

  const totalSupport = classes.reduce((a, c) => a + (c.support || 0), 0)
  const lastUpdated  = classes.length
    ? classes.reduce((a, c)=>(new Date(c.updated_at || 0) > new Date(a || 0) ? c.updated_at : a), null)
    : null

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2 className="admin-card-title">Prediction Quality by Class</h2>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', fontSize:'0.78rem', color:'var(--text-muted)' }}>
          {totalSupport > 0 && <span>{totalSupport.toLocaleString()} samples</span>}
          {lastUpdated && (
            <span>Updated {new Date(lastUpdated).toLocaleDateString('en-SG', { day:'numeric', month:'short' })}</span>
          )}
        </div>
      </div>

      <div style={{ padding:'1.25rem 1.5rem' }}>
        {loading ? (
          <div style={{ height:'280px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span className="admin-spinner"/>
          </div>
        ) : !chartData.length ? (
          <div style={{ height:'280px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div className="admin-empty"><p>No class metrics recorded yet.</p></div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top:10, right:20, left:0, bottom:5 }} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
              <XAxis dataKey="class"
                tick={{ fill:'var(--text-muted)', fontSize:12 }}
                axisLine={{ stroke:'var(--border)' }} tickLine={false}/>
              <YAxis domain={[0, 1]}
                tickFormatter={v => `${Math.round(v * 100)}%`}
                tick={{ fill:'var(--text-muted)', fontSize:11 }}
                axisLine={{ stroke:'var(--border)' }} tickLine={false} width={42}/>
              <Tooltip content={<CustomTooltip/>} cursor={{ fill:'rgba(255,255,255,0.04)' }}/>
              <Legend wrapperStyle={{ fontSize:'0.75rem' }}/>
              <Bar dataKey="Precision" fill="#60a5fa" radius={[3,3,0,0]}/>
              <Bar dataKey="Recall" fill="#a78bfa" radius={[3,3,0,0]}/>
              <Bar dataKey="F1 Score" fill="#00ff41" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Per-class table */}
      <div className="admin-table-wrap">
        <table className="admin-table" aria-label="Per-class prediction quality">
          <thead>
            <tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1 Score</th><th>Support</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign:'center', padding:'2.5rem' }}><span className="admin-spinner"/></td></tr>
            ) : !classes.length ? (
              <tr><td colSpan="5"><div className="admin-empty"><p>No class metrics recorded yet.</p></div></td></tr>
            ) : classes.map(c => (
              <tr key={c.class_name}>
                <td>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:'0.45rem', fontWeight:600 }}>
                    <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:CLASS_COLOR[c.class_name] || 'var(--text-muted)' }}/>
                    {c.class_name}
                  </span>
                </td>
                <td style={{fontFamily:'var(--font-mono)'}}>{pct(c.precision_score)}</td>
                <td style={{fontFamily:'var(--font-mono)'}}>{pct(c.recall_score)}</td>
                <td style={{fontFamily:'var(--font-mono)', fontWeight:600, color:f1Color(c.f1_score)}}>{pct(c.f1_score)}</td>
                <td style={{fontFamily:'var(--font-mono)', color:'var(--text-muted)'}}>
                  {c.support != null ? c.support.toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ViewPredictionQualityPanel
