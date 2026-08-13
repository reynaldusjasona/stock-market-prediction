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

function Landing() {
    const navigate = useNavigate()
    const [landing, setLanding] = useState(null)
    const [plans, setPlans] = useState([])

    useEffect(() => {
        api.get('/landing')
            .then((data) => setLanding(data || null))
            .catch((err) => console.log('landing content failed:', err.message))

        api.get('/subscription/plans')
            .then((data) => setPlans(data || []))
            .catch((err) => console.log('plans failed:', err.message))
    }, [])

    const hero = {
        tag: landing?.hero?.tag || HERO_FALLBACK.tag,
        headline: landing?.hero?.headline || HERO_FALLBACK.headline,
        subline: landing?.hero?.subline || HERO_FALLBACK.subline,
        content: landing?.hero?.content || HERO_FALLBACK.content,
        cta_label: landing?.hero?.cta_label || HERO_FALLBACK.cta_label,
        secondary_label: landing?.hero?.secondary_label || HERO_FALLBACK.secondary_label,
    }

    // about/features are admin-editable but currently empty - skip the
    // whole section rather than render an empty header/grid until real
    // content exists
    const about = landing?.about
    const hasAbout = about && (about.subtitle || (about.cards || []).length > 0)

    const features = landing?.features
    const hasFeatures = features && (features.subtitle || (features.items || []).length > 0)

    // CMS text for the pricing section header - the actual plan card below
    // is always driven live by /subscription/plans, never by this content
    const subscriptionCopy = landing?.subscription || {}

    return (
        <div>
            {/* navbar */}
            <nav className="nav">
                <span className="nav-logo"><img src="/Logo.jpg" alt="StockWise AI" style={{ height: 22, borderRadius: 4, marginRight: 8, verticalAlign: 'middle' }} />StockWise <span>AI</span></span>
                <div className="nav-links">
                    <span onClick={() => document.getElementById('about')?.scrollIntoView({behavior: 'smooth'})}>About</span>
                    <span onClick={() => document.getElementById('features')?.scrollIntoView({behavior: 'smooth'})}>Features</span>
                    <span onClick={() => document.getElementById('testimonials').scrollIntoView({behavior: 'smooth'})}>Testimonials</span>
                    <span onClick={() => document.getElementById('subscription').scrollIntoView({behavior: 'smooth'})}>Subscription</span>
                    <span onClick={() => document.getElementById('faq').scrollIntoView({behavior: 'smooth'})}>FAQ</span>
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
                    {(about.cards || []).length > 0 && (
                        <div className="cards-grid">
                            {about.cards.map((card, i) => (
                                <div className="card" key={card.title || i}>
                                    {card.title && <h3>{card.title}</h3>}
                                    {card.description && <p>{card.description}</p>}
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
                    {(features.items || []).length > 0 && (
                        <div className="cards-grid">
                            {features.items.map((item, i) => (
                                <div className="card" key={item.title || i}>
                                    {item.title && <h3>{item.title}</h3>}
                                    {item.description && <p>{item.description}</p>}
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
                </div>
            </section>

            <ViewFAQ />
        </div>
    )
}

export default Landing
