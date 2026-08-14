import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import '../styles/Landing.css'
import ViewTestimonials from '../components/landing/ViewTestimonials'
import ViewFAQ from '../components/landing/ViewFAQ'

// landing_page_config is currently a single empty-content row - these are
// the same defaults shown to an admin who hasn't filled anything in yet,
// used here so the public page never looks broken/empty in the meantime
const HERO_FALLBACK = {
    tag: '# RETAIL INVESTOR',
    headline: 'Predict the Market with AI Precision',
    subline: null,
    content: 'Harness the power of neural-driven analysis. StockWise AI processes millions of data points across US equity markets.',
    cta_label: 'Register an Account',
    secondary_label: 'Learn more →',
}

// GET /landing returns {sections: [{section_key, title, subtitle, content,
// image_url, is_visible, display_order}, ...]} - buildPublicLandingSections
// on the backend only includes a section at all when it has real content,
// and it joins structured items (about.cards / features.items / marketing.cards)
// into a single "Title: body • Title: body" string per section. Split that
// back into individual items here so Features/About render as distinct
// entries rather than one paragraph.
function parseContentItems(content) {
    if (!content) return []
    return content.split(' • ').map((segment) => {
        const sepIndex = segment.indexOf(': ')
        if (sepIndex === -1) return { title: null, body: segment }
        return { title: segment.slice(0, sepIndex), body: segment.slice(sepIndex + 2) }
    })
}

function getYouTubeEmbedUrl(url) {
    try {
        const parsed = new URL(url)
        if (parsed.hostname.includes('youtu.be')) {
            return `https://www.youtube.com/embed${parsed.pathname}`
        }
        if (parsed.hostname.includes('youtube.com')) {
            if (parsed.pathname === '/watch') {
                const videoId = parsed.searchParams.get('v')
                return videoId ? `https://www.youtube.com/embed/${videoId}` : null
            }
            if (parsed.pathname.startsWith('/embed/')) {
                return url
            }
        }
        return null
    } catch {
        return null
    }
}

function Landing() {
    const navigate = useNavigate()
    const [sections, setSections] = useState({})
    const [plans, setPlans] = useState([])

    useEffect(() => {
        api.get('/landing')
            .then((data) => {
                const list = data?.sections || []
                setSections(Object.fromEntries(list.map((s) => [s.section_key, s])))
            })
            .catch((err) => console.log('landing content failed:', err.message))

        api.get('/subscription/plans')
            .then((data) => setPlans(data || []))
            .catch((err) => console.log('plans failed:', err.message))
    }, [])

    // hero now carries tag/cta_label/secondary_label from the API too.
    // HERO_FALLBACK is only used as a whole-object fallback when the hero
    // section itself is absent from the response entirely - once a hero
    // section exists, its fields are trusted as-is rather than falling
    // back per-field (matching how About/Features already render blank
    // rather than substituting fallback text for individual missing fields)
    const heroSection = sections.hero
    const hero = heroSection ? {
        tag: heroSection.tag,
        headline: heroSection.title,
        // the backend only sends one descriptive string for hero (mapped
        // from content.hero.subline into the section's "content" field) -
        // use it once, as the main paragraph, rather than duplicating it
        // into both subline and content
        subline: null,
        content: heroSection.content,
        cta_label: heroSection.cta_label,
        secondary_label: heroSection.secondary_label,
    } : HERO_FALLBACK

    // a section only appears in the sections array at all when the backend
    // found real content for it, so presence alone means "has content"
    const about = sections.about
    const hasAbout = Boolean(about)
    const aboutItems = parseContentItems(about?.content)

    const features = sections.features
    const hasFeatures = Boolean(features)
    const featureItems = parseContentItems(features?.content)

    const marketing = sections.marketing
    const hasMarketing = Boolean(marketing)
    const videoUrl = marketing?.video_url
    const hasVideo = Boolean(videoUrl)
    const youtubeEmbedUrl = hasVideo ? getYouTubeEmbedUrl(videoUrl) : null
    const marketingItems = parseContentItems(marketing?.content)

    // buildPublicLandingSections now emits a "subscription" section entry
    // when the admin has set a title - footnote text travels in the shared
    // "content" field (same convention as about/features' body text)
    const subscriptionSection = sections.subscription
    const subscriptionCopy = subscriptionSection ? {
        title: subscriptionSection.title,
        subtitle: subscriptionSection.subtitle,
        footnote: subscriptionSection.content,
    } : {}

    // trader_insights add-on card — all fields come from landing_page_config
    // (no separate /subscription/plans entry). Falls back to the previous
    // hardcoded values so the card never looks empty.
    const ti = sections.trader_insights || {}
    const traderCard = {
        name: ti.title || 'TRADER ACCESS',
        price: ti.price || '19.99',
        period: ti.period || 'month',
        bullets: (ti.bullets && ti.bullets.length > 0)
            ? ti.bullets
            : ['Connect with licensed traders', 'Ask a trader for stock analysis', 'View trader-endorsed Buy/Sell signals'],
        cta: ti.cta_label || 'Add to plan',
        footnote: ti.content || 'Requires active Investor Plan',
    }

    return (
        <div>
            {/* navbar */}
            <nav className="nav">
                <span className="nav-logo"><img src="/Logo.jpg" alt="StockWise AI" style={{ height: 22, borderRadius: 4, marginRight: 8, verticalAlign: 'middle' }} />StockWise <span>AI</span></span>
                <div className="nav-links">
                    <span onClick={() => document.getElementById('about')?.scrollIntoView({behavior: 'smooth'})}>About</span>
                    <span onClick={() => document.getElementById('features')?.scrollIntoView({behavior: 'smooth'})}>Features</span>
                    {hasMarketing && (
                        <span onClick={() => document.getElementById('marketing-video')?.scrollIntoView({behavior: 'smooth'})}>Why StockWise</span>
                    )}
                    <span onClick={() => document.getElementById('testimonials').scrollIntoView({behavior: 'smooth'})}>Testimonials</span>
                    <span onClick={() => document.getElementById('subscription').scrollIntoView({behavior: 'smooth'})}>Subscription</span>
                    <span onClick={() => document.getElementById('faq').scrollIntoView({behavior: 'smooth'})}>FAQ</span>
                    <span onClick={() => document.getElementById('documentation').scrollIntoView({behavior: 'smooth'})}>Documentation</span>
                </div>
                <div className="nav-buttons">
                    <button className="btn-login" onClick={() => navigate('/login')}>Login</button>
                    <button className="btn-register" onClick={() => navigate('/register')}>Register</button>
                </div>
            </nav>

            {/* hero */}
            <section className="hero">
                <p className="hero-tag">{hero.tag}</p>
                <h1>{hero.headline}</h1>
                {hero.subline && <p className="hero-subtitle">{hero.subline}</p>}
                <p>{hero.content}</p>
                <div className="hero-buttons">
                    <button className="btn-primary" onClick={() => navigate('/register')}>{hero.cta_label}</button>
                    <button className="btn-secondary" onClick={() => navigate('/login')}>{hero.secondary_label}</button>
                </div>
            </section>

            {hasAbout && (
                <section className="section" id="about">
                    <h2 className="section-title">About</h2>
                    {about.subtitle && <p className="section-sub">{about.subtitle}</p>}
                    {aboutItems.length > 0 && (
                        <div className="cards-grid">
                            {aboutItems.map((item, i) => (
                                <div className="card" key={item.title || i}>
                                    {item.title && <h3>{item.title}</h3>}
                                    {item.body && <p>{item.body}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {hasFeatures && (
                <section className="section" id="features">
                    <h2 className="section-title">Features</h2>
                    {features.subtitle && <p className="section-sub">{features.subtitle}</p>}
                    {featureItems.length > 0 && (
                        <div className="cards-grid">
                            {featureItems.map((item, i) => (
                                <div className="card" key={item.title || i}>
                                    {item.title && <h3>{item.title}</h3>}
                                    {item.body && <p>{item.body}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {hasMarketing && (
                <section className="section" id="marketing-video">
                    <h2 className="section-title">{marketing.title}</h2>
                    {marketing.subtitle && <p className="section-sub">{marketing.subtitle}</p>}
                    {hasVideo && (
                        <div className="video-embed-wrap">
                            {youtubeEmbedUrl ? (
                                <iframe
                                    src={youtubeEmbedUrl}
                                    title="Marketing video"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : (
                                <video src={videoUrl} controls />
                            )}
                        </div>
                    )}
                    {marketingItems.length > 0 && (
                        <div className="cards-grid" style={hasVideo ? { marginTop: '32px' } : undefined}>
                            {marketingItems.map((item, i) => (
                                <div className="card" key={item.title || i}>
                                    {item.title && <h3>{item.title}</h3>}
                                    {item.body && <p>{item.body}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            <ViewTestimonials />

            {/* pricing - plan card is always sourced live from /subscription/plans;
                title/subtitle text above it is admin-editable via landing_page_config */}
            <section className="section" id="subscription">
                <h2 className="section-title" style={{ textAlign: 'center' }}>{subscriptionCopy.title || 'Get Started'}</h2>
                <p className="section-sub" style={{ textAlign: 'center' }}>
                    {subscriptionCopy.subtitle || 'Everything StockWise AI offers, built for how you invest.'}
                </p>
                <div className="landing-plans-grid">
                    {plans.filter((p) => p.id === 'investor').map((p) => (
                        <div className="plan-card" key={p.id}>
                            <p className="plan-name">{(p.name || p.id).toUpperCase()}</p>
                            <p className="plan-price">${p.price}<span>/{p.interval}</span></p>
                            <ul>
                                {(p.features || []).map((f) => (
                                    <li key={f}>✓ {f}</li>
                                ))}
                            </ul>
                            <button className="btn-primary" onClick={() => navigate('/register?intent=subscribe')}>Get started</button>
                            <p style={{ textAlign: 'center', color: '#888', marginTop: '12px', fontSize: '14px' }}>
                                {subscriptionCopy.footnote || 'Cancel anytime.'}
                            </p>
                        </div>
                    ))}
                    <div className="plan-card plan-card-addon">
                        <span className="plan-badge-addon">Add-on</span>
                        <p className="plan-name" style={{ color: '#ffd600' }}>{traderCard.name.toUpperCase()}</p>
                        <p className="plan-price">${traderCard.price}<span>/{traderCard.period}</span></p>
                        <ul>
                            {traderCard.bullets.map((b) => (
                                <li key={b}>✓ {b}</li>
                            ))}
                        </ul>
                        <button className="btn-secondary" onClick={() => navigate('/register?intent=subscribe')}>{traderCard.cta}</button>
                        <p style={{ textAlign: 'center', color: '#888', marginTop: '12px', fontSize: '14px' }}>
                            {traderCard.footnote}
                        </p>
                    </div>
                </div>
            </section>

            <ViewFAQ />

            {/* project documentation */}
            <section className="section" id="documentation">
                <h2 className="section-title" style={{ textAlign: 'center' }}>Documentation</h2>
                <p className="section-sub" style={{ textAlign: 'center' }}>
                    FYP-26-S2-26 project documents — meeting minutes, reports, and technical documentation.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <a
                        className="doc-card-main"
                        href="https://drive.google.com/drive/folders/1utV_7fIpIbIzMvZw-7RYje3zu0l_i111?usp=share_link"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <span className="doc-card-icon">📁</span>
                        <span className="doc-card-text">
                            <span className="doc-card-title">View Project Documents</span>
                            <span className="doc-card-sub">Meeting minutes, PRD, PTD, and more on Google Drive</span>
                        </span>
                        <span className="doc-card-arrow">↗</span>
                    </a>
                </div>
            </section>
        </div>
    )
}

export default Landing
