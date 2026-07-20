import { useEffect, useState } from 'react'
import adminApi from '../../js/adminApi'
import { showToast } from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

const SECTIONS = [
  {key:'hero',label:'Hero',hint:'Main banner — headline, tagline and intro copy' },
  {key:'about',label:'About',hint:'About StockWise AI section' },
  {key:'stats',label:'Stats', hint:'Our Numbers section' },
  {key:'features', label:'Features', hint:'Platform Features section' },
  {key:'cta',label:'CTA', hint:'Call-to-action — sign up prompt' },
]

const blank = key => ({ section_key:key, title:'', subtitle:'', content:'' })

function LandingPageEditorPage() {
  const[sections, setSections]= useState({})
  const[loading,setLoading]= useState(true)
  const[saving,setSaving]= useState(false)
  const[dirty,setDirty]= useState(false)
  const[tab,setTab]= useState('hero')

  useEffect(() => {
    adminApi.getLandingPage()
      .then(d => {
        const rows = Array.isArray(d) ? d : (d?.sections || d?.content || [])
        const map ={}
        SECTIONS.forEach(s =>{map[s.key]= blank(s.key) })
        if (Array.isArray(rows)) {
          rows.forEach(r => { if (r?.section_key) map[r.section_key] = { ...blank(r.section_key), ...r } })
        } else if (rows && typeof rows === 'object') {
          Object.entries(rows).forEach(([k, v]) => { map[k] = { ...blank(k), ...v, section_key:k } })
        }
        setSections(map)
      })
      .catch(err => showToast(err.message || 'Could not load landing content', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const setField = (key, field, value) => {
    setDirty(true)
    setSections(s => ({ ...s, [key]: { ...s[key], [field]: value } }))
  }

  const handleSave = async () => {
    if (!sections.hero?.title?.trim()) { showToast('Hero title is required', 'error'); setTab('hero'); return }
    setSaving(true)
    try {
      // Send back as an array of section rows — same shape as GET
      const payload = SECTIONS.map(s => sections[s.key]).filter(Boolean)
      await adminApi.updateLandingPage(payload)
      setDirty(false)
      showToast('Landing page saved and published', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error')
    } finally { setSaving(false) }
  }

  if (loading) 
	  return <div style={{ textAlign:'center', padding:'4rem' }}><span className="admin-spinner"/></div>

  const active     = sections[tab] || blank(tab)
  const activeMeta = SECTIONS.find(s => s.key === tab)

  return(
    <div>
      <div className="admin-page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1 className="admin-page-title">
            Landing Page Editor
            {dirty && <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#ffd600', display:'inline-block', marginLeft:'0.55rem', verticalAlign:'middle' }} title="Unsaved changes"/>}
          </h1>
          <p className="admin-page-sub">Edit the content displayed on the public landing page.</p>
        </div>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <a href="/" target="_blank" rel="noreferrer" className="btn-admin btn-ghost">Preview Live Page</a>
          <button className="btn-admin btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="admin-spinner" style={{ width:'14px', height:'14px' }}/> Saving…</> : 'Save & Publish'}
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="admin-subtabs" style={{ marginBottom:'1rem' }}>
        {SECTIONS.map(s => (
          <button key={s.key} className={`admin-subtab${tab === s.key ? ' active' : ''}`}
            onClick={() => setTab(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Active section editor */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">{activeMeta?.label} Section</h2>
            <p style={{ margin:'0.25rem 0 0', fontSize:'0.78rem', color:'var(--text-muted)' }}>{activeMeta?.hint}</p>
          </div>
        </div>
        <div className="admin-card-body">
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="lpTitle">Title {tab === 'hero' && '*'}</label>
            <input className="admin-form-input" id="lpTitle" type="text"
              value={active.title || ''} maxLength={120}
              onChange={e => setField(tab, 'title', e.target.value)}/>
            <div style={{ textAlign:'right', fontSize:'0.7rem', color:'var(--text-subtle)', marginTop:'0.25rem' }}>
              {(active.title || '').length} / 120
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="lpSubtitle">Subtitle</label>
            <input className="admin-form-input" id="lpSubtitle" type="text"
              value={active.subtitle || ''} maxLength={200}
              onChange={e => setField(tab, 'subtitle', e.target.value)}/>
            <div style={{ textAlign:'right', fontSize:'0.7rem', color:'var(--text-subtle)', marginTop:'0.25rem' }}>
              {(active.subtitle || '').length} / 200
            </div>
          </div>

          <div className="admin-form-group" style={{ marginBottom:0 }}>
            <label className="admin-form-label" htmlFor="lpContent">Content</label>
            <textarea className="admin-form-textarea" id="lpContent"
              value={active.content || ''} style={{ minHeight:'140px' }}
              onChange={e => setField(tab, 'content', e.target.value)}/>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPageEditorPage
