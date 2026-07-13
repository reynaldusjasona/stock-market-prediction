function ViewFeatureList() {
    const features = [
        { title: 'AI Predictions', desc: 'Multi-timeframe price targets powered by long-short term memory networks.' },
        { title: 'Sentiment Analysis', desc: 'Visual heatmap of market fear and greed extracted from thousands of social signals.' },
        { title: 'Smart Watchlists', desc: 'Dynamic lists that automatically reorganize based on your personal risk profile.' },
        { title: 'Instant Alerts', desc: 'Receive push notifications for price breakouts, volume surges, and unusual activity.' },
        { title: 'Portfolio Tracking', desc: 'Aggregate your accounts and let AI analyze your diversification and returns.' },
        { title: 'API Access', desc: 'Direct REST and GraphQL endpoints for automated trading bots.' },
    ]

    return (
        <section className="section" id="features">
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
    )
}

export default ViewFeatureList
