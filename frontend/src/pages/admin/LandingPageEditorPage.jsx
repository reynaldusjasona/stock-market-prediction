import { useEffect, useState } from 'react'
import adminApi from '../../js/adminApi'
import { showToast } from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

const EMPTY = {
  about: {
    subtitle: 'Institutional-grade intelligence, built for the everyday investor.',
    cards: [
      { title: 'AI Predictions You Can Trust',      description: 'Every forecast comes with a confidence score, so you know the odds before you act.' },
      { title: 'The Market, Read in Real Time',     description: 'We scan news, SEC filings, and social sentiment across US equities the moment they move.' },
      { title: 'Catch Moves Before They Happen',    description: 'Spot sentiment surges and momentum shifts early, not after the price has already run.' },
    ],
  },
  features: {
    subtitle: 'Institutional-grade tools, simplified for the everyday investor.',
    items: [
      { title: 'AI Predictions',      description: 'Multi-timeframe price targets powered by long-short term memory networks.' },
      { title: 'Sentiment Analysis',  description: 'Visual heatmap of market fear and greed extracted from thousands of social signals.' },
      { title: 'Smart Watchlists',    description: 'Dynamic lists that automatically reorganize based on your personal risk profile.' },
      { title: 'Instant Alerts',      description: 'Receive push notifications for price breakouts, volume surges, and unusual activity.' },
      { title: 'Portfolio Tracking',  description: 'Aggregate your accounts and let AI analyze your diversification and returns.' },
      { title: 'API Access',          description: 'Direct REST and GraphQL endpoints for automated trading bots.' },
    ],
  },
  testimonials: [
    { name: 'Marcus Chen',   text: 'The sentiment engine is frighteningly accurate. It caught the NVDA rally three days before the earnings report.' },
    { name: 'Sarah Jenkins', text: 'StockWise AI turned my trading from a hobby into a systematic process. The risk-adjusted return tracking is a game changer.' },
    { name: 'Michael Chen',  text: 'The AI predictions for my favorite stocks have been incredibly accurate. Truly an unfair advantage.' },
  ],
  subscription: {
    title:    'One Plan. Full Access.',
    subtitle: 'Everything StockWise AI offers, in a single subscription.',
    price:    '$29',
    bullets: [
      'Unlimited AI Predictions',
      'Sentiment Heatmaps',
      'Advanced Portfolio Analytics',
      'Priority Discord Support',
    ],
  },
  faqs: [
    { question: 'How accurate are the AI predictions?', answer: 'Our models maintain a back-tested accuracy of 82% over a 3-year period across the S&P 500.' },
    { question: 'Which markets do you cover?',          answer: 'We currently cover US equity markets including NYSE and NASDAQ.' },
    { question: 'Can I cancel my subscription anytime?',answer: 'Yes, you can cancel anytime with no hidden fees.' },
  ],
}

const SectionCard = ({ title, children }) => (
  <div className="admin-card" style={{ marginBottom:'1.25rem' }}>
    <div className="admin-card-header">
      <h3 style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--text)', margin:0 }}>{title}</h3>
    </div>
    <div style={{ padding:'1.25rem 1.5rem' }}>{children}</div>
  </div>
)

const Field = ({ label, value, onChange, multiline = false, maxLength }) => (
  <div className="admin-form-group" style={{ marginBottom:'0.85rem' }}>
    <label className="admin-form-label">{label}</label>
    {multiline ? (
      <textarea className="admin-form-input" rows={3}
        value={value} onChange={e => onChange(e.target.value)}
        maxLength={maxLength}
        style={{ resize:'vertical', fontFamily:'var(--font-sans)', lineHeight:1.5 }}/>
    ) : (
      <input className="admin-form-input" type="text"
        value={value} onChange={e => onChange(e.target.value)}
        maxLength={maxLength}/>
    )}
    {maxLength && (
      <div style={{ fontSize:'0.7rem', color:'var(--text-subtle)', textAlign:'right', marginTop:'0.2rem' }}>
        {value?.length ?? 0} / {maxLength}
      </div>
    )}
  </div>
)

const clone = obj => JSON.parse(JSON.stringify(obj))

function LandingPageEditorPage() {
  const [data,    setData]    = useState(clone(EMPTY))
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [tab,     setTab]     = useState('about')

  useEffect(() => {
    adminApi.getLandingPage()
      .then(d => {
        if (!d) return
        setData({
          about: {
            subtitle: d.about?.subtitle ?? EMPTY.about.subtitle,
            cards:    d.about?.cards?.length ? d.about.cards : clone(EMPTY.about.cards),
          },
          features: {
            subtitle: d.features?.subtitle ?? EMPTY.features.subtitle,
            items:    d.features?.items?.length ? d.features.items : clone(EMPTY.features.items),
          },
          testimonials: d.testimonials?.length ? d.testimonials : clone(EMPTY.testimonials),
          subscription: {
            title:    d.subscription?.title    ?? EMPTY.subscription.title,
            subtitle: d.subscription?.subtitle ?? EMPTY.subscription.subtitle,
            price:    d.subscription?.price    ?? EMPTY.subscription.price,
            bullets:  d.subscription?.bullets?.length ? d.subscription.bullets : clone(EMPTY.subscription.bullets),
          },
          faqs: d.faqs?.length ? d.faqs : clone(EMPTY.faqs),
        })
      })
      .catch(() => { /* keep defaults on error */ })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!data.about.subtitle?.trim()) { showToast('About subtitle is required', 'error'); return }
    if (!data.features.subtitle?.trim()) { showToast('Features subtitle is required', 'error'); return }
    if (!data.subscription.title?.trim()) { showToast('Subscription title is required', 'error'); return }
    if (!data.subscription.price?.trim()) { showToast('Subscription price is required', 'error'); return }

    setSaving(true)
    try {
      await adminApi.updateLandingPage(data)
      showToast('Landing page saved successfully', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to save landing page', 'error')
    } finally { setSaving(false) }
  }

  const handleReset = () => {
    if (!window.confirm('Reset to default content? This cannot be undone.')) return
    setData(clone(EMPTY))
    showToast('Reset to default content', 'success')
  }

  const setAbout     = fn => setData(d => { const n = clone(d); fn(n.about);    return n })
  const setFeatures  = fn => setData(d => { const n = clone(d); fn(n.features); return n })
  const setTestimonials = fn => setData(d => { const n = clone(d); fn(n.testimonials); return n })
  const setSub       = fn => setData(d => { const n = clone(d); fn(n.subscription); return n })
  const setFaqs      = fn => setData(d => { const n = clone(d); fn(n.faqs);     return n })

  const TABS = [
    { key:'about',         label:'About'        },
    { key:'features',      label:'Features'     },
    { key:'testimonials',  label:'Testimonials' },
    { key:'subscription',  label:'Subscription' },
    { key:'faq',           label:'FAQ'          },
  ]

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}>
      <span className="admin-spinner"/>
    </div>
  )

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Landing Page Editor</h1>
          <p className="admin-page-sub">Edit the content displayed on the public landing page.</p>
        </div>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button className="btn-admin btn-ghost" onClick={handleReset}>Reset to Default</button>
          <button className="btn-admin btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <><span className="admin-spinner" style={{ width:'14px', height:'14px' }}/> Saving…</>
              : 'Save Changes'
            }
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="admin-subtabs" style={{ marginBottom:'1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} className={`admin-subtab${tab===t.key?' active':''}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── About ── */}
      {tab === 'about' && (
        <>
          <SectionCard title="About Section — Subtitle">
            <Field label="Subtitle"
              value={data.about.subtitle}
              onChange={v => setAbout(a => { a.subtitle = v })}
              maxLength={200}/>
          </SectionCard>

          {data.about.cards.map((card, i) => (
            <SectionCard key={i} title={`About Card ${i + 1}`}>
              <Field label="Title"
                value={card.title}
                onChange={v => setAbout(a => { a.cards[i].title = v })}
                maxLength={80}/>
              <Field label="Description"
                value={card.description}
                onChange={v => setAbout(a => { a.cards[i].description = v })}
                multiline maxLength={300}/>
            </SectionCard>
          ))}
        </>
      )}

      {/* ── Features ── */}
      {tab === 'features' && (
        <>
          <SectionCard title="Features Section — Subtitle">
            <Field label="Subtitle"
              value={data.features.subtitle}
              onChange={v => setFeatures(f => { f.subtitle = v })}
              maxLength={200}/>
          </SectionCard>

          {data.features.items.map((item, i) => (
            <SectionCard key={i} title={`Feature ${i + 1}`}>
              <Field label="Title"
                value={item.title}
                onChange={v => setFeatures(f => { f.items[i].title = v })}
                maxLength={60}/>
              <Field label="Description"
                value={item.description}
                onChange={v => setFeatures(f => { f.items[i].description = v })}
                multiline maxLength={200}/>
            </SectionCard>
          ))}
        </>
      )}

      {/* ── Testimonials ── */}
      {tab === 'testimonials' && (
        <>
          {data.testimonials.map((t, i) => (
            <SectionCard key={i} title={`Testimonial ${i + 1}`}>
              <Field label="Name"
                value={t.name}
                onChange={v => setTestimonials(ts => { ts[i].name = v })}
                maxLength={80}/>
              <Field label="Quote"
                value={t.text}
                onChange={v => setTestimonials(ts => { ts[i].text = v })}
                multiline maxLength={300}/>
            </SectionCard>
          ))}
        </>
      )}

      {/* ── Subscription ── */}
      {tab === 'subscription' && (
        <>
          <SectionCard title="Subscription — Header">
            <Field label="Section Title"
              value={data.subscription.title}
              onChange={v => setSub(s => { s.title = v })}
              maxLength={80}/>
            <Field label="Section Subtitle"
              value={data.subscription.subtitle}
              onChange={v => setSub(s => { s.subtitle = v })}
              maxLength={200}/>
            <Field label="Price (e.g. $29)"
              value={data.subscription.price}
              onChange={v => setSub(s => { s.price = v })}
              maxLength={20}/>
          </SectionCard>

          <SectionCard title="Subscription — Plan Bullets">
            {data.subscription.bullets.map((bullet, i) => (
              <Field key={i} label={`Bullet ${i + 1}`}
                value={bullet}
                onChange={v => setSub(s => { s.bullets[i] = v })}
                maxLength={100}/>
            ))}
          </SectionCard>
        </>
      )}

      {/* ── FAQ ── */}
      {tab === 'faq' && (
        <>
          {data.faqs.map((faq, i) => (
            <SectionCard key={i} title={`FAQ ${i + 1}`}>
              <Field label="Question"
                value={faq.question}
                onChange={v => setFaqs(fs => { fs[i].question = v })}
                maxLength={200}/>
              <Field label="Answer"
                value={faq.answer}
                onChange={v => setFaqs(fs => { fs[i].answer = v })}
                multiline maxLength={500}/>
            </SectionCard>
          ))}
        </>
      )}

    </div>
  )
}

export default LandingPageEditorPage
