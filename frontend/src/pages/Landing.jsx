import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/Landing.css'

function Landing() {
    const [openFaq, setOpenFaq] = useState(null)
    const navigate = useNavigate()

    const features = [
        { title: 'AI Predictions', desc: 'Multi-timeframe price targets powered by long-short term memory networks.' },
        { title: 'Sentiment Analysis', desc: 'Visual heatmap of market fear and greed extracted from thousands of social signals.' },
        { title: 'Smart Watchlists', desc: 'Dynamic lists that automatically reorganize based on your personal risk profile.' },
        { title: 'Instant Alerts', desc: 'Receive push notifications for price breakouts, volume surges, and unusual activity.' },
        { title: 'Portfolio Tracking', desc: 'Aggregate your accounts and let AI analyze your diversification and returns.' },
        { title: 'API Access', desc: 'Direct REST and GraphQL endpoints for automated trading bots.' },
    ]

    const testimonials = [
        { name: 'Marcus Chen', text: 'The sentiment engine is frighteningly accurate. It caught the NVDA rally three days before the earnings report.' },
        { name: 'Sarah Jenkins', text: 'StockWise AI turned my trading from a hobby into a systematic process. The risk-adjusted return tracking is a game changer.' },
        { name: 'Michael Chen', text: 'The AI predictions for my favorite stocks have been incredibly accurate. Truly an unfair advantage.' },
    ]

    const faqs = [
        { question: 'How accurate are the AI predictions?', answer: 'Our models maintain a back-tested accuracy of 82% over a 3-year period across the S&P 500.' },
        { question: 'Which markets do you cover?', answer: 'We currently cover US equity markets including NYSE and NASDAQ.' },
        { question: 'Can I cancel my subscription anytime?', answer: 'Yes, you can cancel anytime with no hidden fees.' },
    ]

    return (
        <div>
            {/* navbar */}
            <nav className="nav">
                <span className="nav-logo">StockWise <span>AI</span></span>
                <div className="nav-buttons">
                    <button className="btn-login" onClick={() => navigate('/login')}>Login</button>
                    <button className="btn-register" onClick={() => navigate('/register')}>Register</button>
                </div>
            </nav>

            {/* hero */}
            <section className="hero">
                <p className="hero-tag"># RETAIL INVESTOR</p>
                <h1>Predict the Market with <span>AI Precision</span></h1>
                <p>Harness the power of neural-driven analysis. StockWise AI processes millions of data points across US equity markets.</p>
                <div className="hero-buttons">
                    <button className="btn-primary" onClick={() => navigate('/register')}>Register an Account</button>
                    <button className="btn-secondary" onClick={() => navigate('/login')}>Learn more →</button>
                </div>
            </section>

            {/* about */}
            <section className="section">
                <h2 className="section-title">About StockWise AI</h2>
                <p className="section-sub">Institutional-grade intelligence, built for the everyday investor.</p>
                <div className="cards-grid">
                    <div className="card">
                        <h3>AI Predictions You Can Trust</h3>
                        <p>Every forecast comes with a confidence score, so you know the odds before you act.</p>
                    </div>
                    <div className="card">
                        <h3>The Market, Read in Real Time</h3>
                        <p>We scan news, SEC filings, and social sentiment across US equities the moment they move.</p>
                    </div>
                    <div className="card">
                        <h3>Catch Moves Before They Happen</h3>
                        <p>Spot sentiment surges and momentum shifts early, not after the price has already run.</p>
                    </div>
                </div>
            </section>

            {/* features */}
            <section className="section">
                <h2 className="section-title">The Professional Toolkit</h2>
                <p className="section-sub">Institutional-grade tools, simplified for the everyday investor.</p>
                <div className="cards-grid">
                    {features.map((f) => (
                        <div className="card" key={f.title}>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* testimonials */}
            <section className="section">
                <h2 className="section-title">What Early Investors Are Saying</h2>
                <div className="cards-grid">
                    {testimonials.map((t) => (
                        <div className="testimonial-card" key={t.name}>
                            <p className="stars">★★★★★</p>
                            <p className="quote">"{t.text}"</p>
                            <p className="author">{t.name}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* subscription */}
            <section className="section">
                <h2 className="section-title" style={{textAlign: 'center'}}>One Plan. Full Access.</h2>
                <p className="section-sub" style={{textAlign: 'center'}}>Everything StockWise AI offers, in a single subscription.</p>
                <div className="plan-card">
                    <p className="plan-name">PRO</p>
                    <p className="plan-price">$29<span>/mo</span></p>
                    <ul>
                        <li>✓ Unlimited AI Predictions</li>
                        <li>✓ Sentiment Heatmaps</li>
                        <li>✓ Advanced Portfolio Analytics</li>
                        <li>✓ Priority Discord Support</li>
                    </ul>
                    <button className="btn-primary" onClick={() => navigate('/register')}>Get started</button>
                    <p style={{textAlign: 'center', color: '#888', marginTop: '12px', fontSize: '14px'}}>Cancel anytime.</p>
                </div>
            </section>

            {/* faq */}
            <section className="section">
                <h2 className="section-title">Frequently Asked Questions</h2>
                {faqs.map((faq, index) => (
                    <div className="faq-item" key={index}>
                        <div className="faq-question" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                            <span>{faq.question}</span>
                            <span>{openFaq === index ? '∧' : '∨'}</span>
                        </div>
                        {openFaq === index && <p className="faq-answer">{faq.answer}</p>}
                    </div>
                ))}
            </section>
        </div>
    )
}

export default Landing