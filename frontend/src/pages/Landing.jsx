import { useNavigate } from 'react-router-dom'
import '../styles/Landing.css'
import ViewAbout from '../components/landing/ViewAbout'
import ViewFeatureList from '../components/landing/ViewFeatureList'
import ViewTestimonials from '../components/landing/ViewTestimonials'
import ViewSubscriptionPlan from '../components/landing/ViewSubscriptionPlan'
import ViewFAQ from '../components/landing/ViewFAQ'

function Landing() {
    const navigate = useNavigate()

    return (
        <div>
            {/* navbar */}
            <nav className="nav">
                <span className="nav-logo">StockWise <span>AI</span></span>
                <div className="nav-links">
                    <span onClick={() => document.getElementById('about').scrollIntoView({behavior: 'smooth'})}>About</span>
                    <span onClick={() => document.getElementById('features').scrollIntoView({behavior: 'smooth'})}>Features</span>
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
                <h1>Predict the Market with <span>AI Precision</span></h1>
                <p>Harness the power of neural-driven analysis. StockWise AI processes millions of data points across US equity markets.</p>
                <div className="hero-buttons">
                    <button className="btn-primary" onClick={() => navigate('/register')}>Register an Account</button>
                    <button className="btn-secondary" onClick={() => navigate('/login')}>Learn more →</button>
                </div>
            </section>

            <ViewAbout />
            <ViewFeatureList />
            <ViewTestimonials />
            <ViewSubscriptionPlan />
            <ViewFAQ />
        </div>
    )
}

export default Landing
