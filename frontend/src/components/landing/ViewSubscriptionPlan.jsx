import { useNavigate } from 'react-router-dom'

function ViewSubscriptionPlan() {
    const navigate = useNavigate()

    return (
        <section className="section" id="subscription">
            <h2 className="section-title" style={{ textAlign: 'center' }}>One Plan. Full Access.</h2>
            <p className="section-sub" style={{ textAlign: 'center' }}>Everything StockWise AI offers, in a single subscription.</p>
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
                <p style={{ textAlign: 'center', color: '#888', marginTop: '12px', fontSize: '14px' }}>Cancel anytime.</p>
            </div>
        </section>
    )
}

export default ViewSubscriptionPlan
