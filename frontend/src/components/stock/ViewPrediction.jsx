const TIMEFRAME_LABELS = {
    '1d': '1 Day',
    '3d': '3 Day',
    '5d': '5 Day',
}

function ViewPrediction({ predData }) {
    return (
        <div className="tab-content">
            {predData ? (
                <>
                    <div className="prediction-box">
                        <div className={'signal-big signal-' + (predData.signal || '').toLowerCase()}>
                            {(predData.signal || '').toUpperCase()}
                        </div>
                        <div className="confidence-line">Confidence: {predData.confidence}%</div>
                        <div className="risk-line">Risk Level: {predData.risk_level}</div>
                        <p className="reasoning-text">{predData.reasoning}</p>
                    </div>

                    {predData.predictions && predData.predictions.length > 0 && (
                        <>
                            <div className="pred-section-heading">Prediction by Timeframe</div>
                            <div className="pred-timeframe-grid">
                                {predData.predictions.map((p) => (
                                    <div className="pred-timeframe-card" key={p.timeframe}>
                                        <div className="pred-timeframe-label">
                                            {TIMEFRAME_LABELS[p.timeframe] || p.timeframe}
                                        </div>
                                        <div className={'pred-signal pred-signal-' + (p.signal || '').toLowerCase()}>
                                            {(p.signal || '').toUpperCase()}
                                        </div>
                                        <div className="pred-confidence">{p.confidence}%</div>
                                        <div className="pred-risk">{p.risk_level}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            ) : (
                <p>No prediction available</p>
            )}
        </div>
    )
}

export default ViewPrediction
