function ViewPrediction({ predData }) {
    return (
        <div className="tab-content">
            {predData ? (
                <div className="prediction-box">
                    <div className={'signal-big signal-' + (predData.signal || '').toLowerCase()}>
                        {(predData.signal || '').toUpperCase()}
                    </div>
                    <div className="confidence-line">Confidence: {predData.confidence}%</div>
                    <div className="risk-line">Risk Level: {predData.risk_level}</div>
                    <p className="reasoning-text">{predData.reasoning}</p>
                </div>
            ) : (
                <p>No prediction available</p>
            )}
        </div>
    )
}

export default ViewPrediction
