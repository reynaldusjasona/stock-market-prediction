const STRONG_BUY_THRESHOLD = 80

function displaySignal(rec) {
    if (rec.signal === 'Buy' && rec.confidence_score >= STRONG_BUY_THRESHOLD) {
        return 'Strong Buy'
    }
    return rec.signal
}

function signalClass(rec) {
    if (rec.signal === 'Buy' && rec.confidence_score >= STRONG_BUY_THRESHOLD) {
        return 'signal-strong-buy'
    }
    return 'signal-' + (rec.signal || '').toLowerCase()
}

function ViewStockRecommendation({ recommendations, navigate }) {
    return (
        <div className="recommendations-grid">
            {recommendations.map((rec) => (
                <div
                    className="recommendation-card"
                    key={rec.ticker}
                    onClick={() => navigate && navigate(`/stock/${rec.ticker}`)}
                    style={navigate ? { cursor: 'pointer' } : undefined}
                >
                    <div className="rec-ticker-row">
                        <span className="rec-ticker">{rec.ticker}</span>
                        {rec.company_name && <span className="rec-company">{rec.company_name}</span>}
                    </div>
                    <div className={'rec-signal ' + signalClass(rec)}>
                        {(displaySignal(rec) || '').toUpperCase()}
                    </div>
                    <div className="rec-confidence">Match Score: {Math.round(rec.confidence_score)}%</div>
                    <div className="rec-risk">Risk Level: {rec.risk_level}</div>
                    <p className="rec-reasoning">{rec.reason}</p>
                </div>
            ))}
        </div>
    )
}

export default ViewStockRecommendation
