function ViewStockRecommendation({ recommendations }) {
    return (
        <div className="recommendations-grid">
            {recommendations.map((rec) => (
                <div className="recommendation-card" key={rec.ticker}>
                    <div className="rec-ticker">{rec.ticker}</div>
                    <div className={'rec-signal signal-' + (rec.signal || '').toLowerCase()}>
                        {(rec.signal || '').toUpperCase()}
                    </div>
                    <div className="rec-confidence">Confidence: {rec.confidence}%</div>
                    <div className="rec-risk">Risk Level: {rec.risk_level}</div>
                    <p className="rec-reasoning">{rec.reasoning}</p>
                </div>
            ))}
        </div>
    )
}

export default ViewStockRecommendation
