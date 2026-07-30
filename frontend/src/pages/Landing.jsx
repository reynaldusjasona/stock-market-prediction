import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import '../styles/Landing.css'
import ViewLandingSection from '../components/landing/ViewLandingSection'
import ViewTestimonials from '../components/landing/ViewTestimonials'
import ViewFAQ from '../components/landing/ViewFAQ'

const HERO_FALLBACK = {
    section_key: 'hero',
    title: 'Predict the Market with AI Precision',
    subtitle: null,
    content: 'Harness the power of neural-driven analysis. StockWise AI processes millions of data points across US equity markets.',
}

function Landing() {
    const navigate = useNavigate()
    const [sections, setSections] = useState([])
    const [plans, setPlans] = useState([])

    useEffect(() => {
        api.get('/landing')
            .then((data) => setSections(data.sections || []))
            .catch((err) => console.log('landing content failed:', err.message))

        api.get('/subscription/plans')
            .then((data) => setPlans(data || []))
            .catch((err) => console.log('plans failed:', err.message))
    }, [])

    function sectionByKey(key) {
        return sections.find((s) => s.section_key === key && s.is_visible !== false)
    }

    const hero = sectionByKey('hero') || HERO_FALLBACK
    // hero/cta get dedicated placement (banner-top, closer-bottom); the rest
    // render as a block in the order the CMS gives us
    const middleSections = sections
        .filter((s) => s.is_visible !== false && !['hero', 'cta'].includes(s.section_key))
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    const cta = sectionByKey('cta')

    return (
        <div>
            {/* navbar */}
            <nav className="nav">
                <span className="nav-logo">StockWise <span>AI</span></span>
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
                <p className="hero-tag"># RETAIL INVESTOR</p>
                <h1>{hero.title}</h1>
                {hero.subtitle && <p className="hero-subtitle">{hero.subtitle}</p>}
                <p>{hero.content}</p>
                <div className="hero-buttons">
                    <button className="btn-primary" onClick={() => navigate('/register')}>Register an Account</button>
                    <button className="btn-secondary" onClick={() => navigate('/login')}>Learn more &rarr;</button>
                </div>
            </section>

            {middleSections.map((section) => (
                <ViewLandingSection key={section.section_key} section={section} />
            ))}

            <ViewTestimonials />

            {/* pricing - sourced from /subscription/plans, not landing_content */}
            <section className="section" id="subscription">
                <h2 className="section-title" style={{ textAlign: 'center' }}>Get Started</h2>
                <p className="section-sub" style={{ textAlign: 'center' }}>Everything StockWise AI offers, built for how you invest.</p>
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
                            <p style={{ textAlign: 'center', color: '#888', marginTop: '12px', fontSize: '14px' }}>Cancel anytime.</p>
                        </div>
                    ))}
                </div>
            </section>

            <ViewFAQ />

            {cta && <ViewLandingSection section={cta} />}
        </div>
    )
}

export default Landing
