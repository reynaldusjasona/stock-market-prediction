import {useEffect, useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

const BLANK ={
  hero: { tag:'', headline:'', subline:'', cta_label:'', secondary_label:'' },
  about: { subtitle:'', cards:[{title:'',body:''},{title:'',body:''},{title:'',body:''}] },
  features: { subtitle:'', items:[{title:'',body:''},{title:'',body:''},{title:'',body:''},{title:'',body:''},{title:'',body:''},{title:'',body:''}] },
  testimonials: [{name:'',quote:'',rating:5},{name:'',quote:'',rating:5},{name:'',quote:'',rating:5}],
  subscription: { title:'', subtitle:'', plan_name:'', price:'', period:'', bullets:['','','',''], cta_label:'', footnote:'' },
  faqs: [{question:'',answer:''},{question:'',answer:''},{question:'',answer:''}],
}

const clone = o => JSON.parse(JSON.stringify(o))

const SECTIONS = [
  {key:'hero',label:'Hero' },
  {key:'about',label:'About' },
  {key:'features',label:'Features' },
  {key:'testimonials',label:'Testimonials' },
  {key:'subscription',label:'Subscription' },
  {key:'faqs',label:'FAQ' },
]

function LandingPageEditorPage() {
  const[data,setData]= useState(null)
  const[loading,setLoading]= useState(true)
  const[saving,setSaving]= useState(false)
  const[dirty,setDirty]= useState(false)
  const[tab,setTab]= useState('hero')
  const[loadError,setLoadError]= useState('')

  useEffect(() => {
    adminApi.getLandingPage()
      .then(d => {
        if (!d) { setData(clone(BLANK)); return }
        setData({
          hero: { ...BLANK.hero, ...(d.hero || {}) },
          about:{ ...BLANK.about, ...(d.about || {}), cards: d.about?.cards?.length ? d.about.cards : BLANK.about.cards },
          features:{ ...BLANK.features, ...(d.features || {}), items: d.features?.items?.length ? d.features.items : BLANK.features.items },
          testimonials: d.testimonials?.length ? d.testimonials : clone(BLANK.testimonials),
          subscription:{ ...BLANK.subscription, ...(d.subscription || {}), bullets: d.subscription?.bullets?.length ? d.subscription.bullets : BLANK.subscription.bullets },
          faqs: d.faqs?.length ? d.faqs : clone(BLANK.faqs),
        })
      })
      .catch(err => {
        setLoadError(err.message || 'Could not load landing content from the database.')
        setData(clone(BLANK))
      })
      .finally(() => setLoading(false))
  }, [])

  const mark = () => { if (!dirty) setDirty(true) }

  const setHero= fn => setData(d => { const n = clone(d); fn(n.hero); mark(); return n })
  const setAbout= fn => setData(d => { const n = clone(d); fn(n.about); mark(); return n })
  const setFeatures= fn => setData(d => { const n = clone(d); fn(n.features); mark(); return n })
  const setTestimonials= fn => setData(d => { const n = clone(d); fn(n.testimonials); mark(); return n })
  const setSubscription= fn => setData(d => { const n = clone(d); fn(n.subscription); mark(); return n })
  const setFaqs= fn => setData(d => { const n = clone(d); fn(n.faqs); mark(); return n })

  const handleSave = async()=> {
    if (!data.hero.headline?.trim()) { showToast('Hero headline is required', 'error'); setTab('hero'); return }
    setSaving(true)
    try {
      await adminApi.updateLandingPage(data)
      setDirty(false)
      showToast('Landing page saved and published', 'success')
    } 
	catch (err){
      showToast(err.message || 'Failed to save', 'error')
    } 
	finally { 
	  setSaving(false) 
	}
  }

  if (loading) 
	  return <div style={{ textAlign:'center', padding:'4rem' }}><span className="admin-spinner"/></div>

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

      {loadError && (
        <div className="admin-alert error">
          {loadError} Showing an empty form — content will populate once the database returns data.
        </div>
      )}

      <div className="admin-subtabs" style={{ marginBottom:'1rem' }}>
        {SECTIONS.map(s => (
          <button key={s.key} className={`admin-subtab${tab === s.key ? ' active' : ''}`} onClick={() => setTab(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {tab === 'hero' && (
        <div className="admin-card">
          <div className="admin-card-header"><h2 className="admin-card-title">Hero Section</h2></div>
          <div className="admin-card-body">
            <div className="admin-form-group">
              <label className="admin-form-label">Tag</label>
              <input className="admin-form-input" maxLength={40} value={data.hero.tag}
                onChange={e => setHero(h => { h.tag = e.target.value })}/>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Headline *</label>
              <input className="admin-form-input" maxLength={100} value={data.hero.headline}
                onChange={e => setHero(h => { h.headline = e.target.value })}/>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Subline</label>
              <textarea className="admin-form-textarea" maxLength={250} value={data.hero.subline}
                onChange={e => setHero(h => { h.subline = e.target.value })}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div className="admin-form-group" style={{ marginBottom:0 }}>
                <label className="admin-form-label">CTA Button Label</label>
                <input className="admin-form-input" maxLength={40} value={data.hero.cta_label}
                  onChange={e => setHero(h => { h.cta_label = e.target.value })}/>
              </div>
              <div className="admin-form-group" style={{ marginBottom:0 }}>
                <label className="admin-form-label">Secondary Link Label</label>
                <input className="admin-form-input" maxLength={40} value={data.hero.secondary_label}
                  onChange={e => setHero(h => { h.secondary_label = e.target.value })}/>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'about' && (
        <div className="admin-card">
          <div className="admin-card-header"><h2 className="admin-card-title">About Section</h2></div>
          <div className="admin-card-body">
            <div className="admin-form-group">
              <label className="admin-form-label">Subtitle</label>
              <input className="admin-form-input" maxLength={200} value={data.about.subtitle}
                onChange={e => setAbout(a => { a.subtitle = e.target.value })}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>
              {data.about.cards.map((c, i) => (
                <div key={i} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', padding:'1rem' }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', color:'var(--text-subtle)', marginBottom:'0.6rem' }}>Card {i+1}</div>
                  <input className="admin-form-input" style={{ marginBottom:'0.6rem' }} maxLength={60} value={c.title}
                    onChange={e => setAbout(a => { a.cards[i].title = e.target.value })} placeholder="Title"/>
                  <textarea className="admin-form-textarea" style={{ minHeight:'70px' }} value={c.body}
                    onChange={e => setAbout(a => { a.cards[i].body = e.target.value })} placeholder="Description"/>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'features' && (
        <div className="admin-card">
          <div className="admin-card-header"><h2 className="admin-card-title">Features Section</h2></div>
          <div className="admin-card-body">
            <div className="admin-form-group">
              <label className="admin-form-label">Subtitle</label>
              <input className="admin-form-input" maxLength={200} value={data.features.subtitle}
                onChange={e => setFeatures(f => { f.subtitle = e.target.value })}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              {data.features.items.map((f, i) => (
                <div key={i} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', padding:'1rem' }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', color:'var(--text-subtle)', marginBottom:'0.6rem' }}>Feature {i+1}</div>
                  <input className="admin-form-input" style={{ marginBottom:'0.6rem' }} maxLength={60} value={f.title}
                    onChange={e => setFeatures(ff => { ff.items[i].title = e.target.value })} placeholder="Title"/>
                  <textarea className="admin-form-textarea" style={{ minHeight:'60px' }} value={f.body}
                    onChange={e => setFeatures(ff => { ff.items[i].body = e.target.value })} placeholder="Description"/>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'testimonials' && (
        <div className="admin-card">
          <div className="admin-card-header"><h2 className="admin-card-title">Testimonials</h2></div>
          <div className="admin-card-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>
              {data.testimonials.map((t, i) => (
                <div key={i} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', padding:'1rem' }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', color:'var(--text-subtle)', marginBottom:'0.6rem' }}>Testimonial {i+1}</div>
                  <input className="admin-form-input" style={{ marginBottom:'0.6rem' }} maxLength={40} value={t.name}
                    onChange={e => setTestimonials(ts => { ts[i].name = e.target.value })} placeholder="Name"/>
                  <textarea className="admin-form-textarea" style={{ minHeight:'90px', marginBottom:'0.6rem' }} maxLength={300} value={t.quote}
                    onChange={e => setTestimonials(ts => { ts[i].quote = e.target.value })} placeholder="Quote"/>
                  <input className="admin-form-input" type="number" min={1} max={5} value={t.rating}
                    onChange={e => setTestimonials(ts => { ts[i].rating = Number(e.target.value) })} placeholder="Rating (1-5)"/>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'subscription' && (
        <div className="admin-card">
          <div className="admin-card-header"><h2 className="admin-card-title">Subscription Section</h2></div>
          <div className="admin-card-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">Title</label>
                <input className="admin-form-input" maxLength={80} value={data.subscription.title}
                  onChange={e => setSubscription(s => { s.title = e.target.value })}/>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Subtitle</label>
                <input className="admin-form-input" maxLength={150} value={data.subscription.subtitle}
                  onChange={e => setSubscription(s => { s.subtitle = e.target.value })}/>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Plan Name</label>
                <input className="admin-form-input" maxLength={20} value={data.subscription.plan_name}
                  onChange={e => setSubscription(s => { s.plan_name = e.target.value })}/>
              </div>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <div className="admin-form-group" style={{ flex:1 }}>
                  <label className="admin-form-label">Price</label>
                  <input className="admin-form-input" value={data.subscription.price}
                    onChange={e => setSubscription(s => { s.price = e.target.value })}/>
                </div>
                <div className="admin-form-group" style={{ flex:1 }}>
                  <label className="admin-form-label">Period</label>
                  <input className="admin-form-input" value={data.subscription.period}
                    onChange={e => setSubscription(s => { s.period = e.target.value })}/>
                </div>
              </div>
            </div>

            <div className="admin-form-label" style={{ marginTop:'0.5rem' }}>Feature Bullets</div>
            {data.subscription.bullets.map((b, i) => (
              <input key={i} className="admin-form-input" style={{ marginBottom:'0.6rem' }} value={b}
                onChange={e => setSubscription(s => { s.bullets[i] = e.target.value })}/>
            ))}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'0.5rem' }}>
              <div className="admin-form-group" style={{ marginBottom:0 }}>
                <label className="admin-form-label">CTA Label</label>
                <input className="admin-form-input" maxLength={40} value={data.subscription.cta_label}
                  onChange={e => setSubscription(s => { s.cta_label = e.target.value })}/>
              </div>
              <div className="admin-form-group" style={{ marginBottom:0 }}>
                <label className="admin-form-label">Footnote</label>
                <input className="admin-form-input" maxLength={60} value={data.subscription.footnote}
                  onChange={e => setSubscription(s => { s.footnote = e.target.value })}/>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'faqs' && (
        <div className="admin-card">
          <div className="admin-card-header"><h2 className="admin-card-title">FAQ Section</h2></div>
          <div className="admin-card-body">
            {data.faqs.map((f, i) => (
              <div key={i} style={{ marginBottom:'1rem', paddingBottom:'1rem', borderBottom: i < data.faqs.length-1 ? '1px solid var(--border)' : 'none' }}>
                <div className="admin-form-label">Question {i+1}</div>
                <input className="admin-form-input" style={{ marginBottom:'0.6rem' }} maxLength={150} value={f.question}
                  onChange={e => setFaqs(fs => { fs[i].question = e.target.value })} placeholder="Question"/>
                <textarea className="admin-form-textarea" style={{ minHeight:'70px' }} maxLength={400} value={f.answer}
                  onChange={e => setFaqs(fs => { fs[i].answer = e.target.value })} placeholder="Answer"/>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default LandingPageEditorPage
