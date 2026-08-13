const TIMEFRAME_LABELS = {
    '1d': '1 Day',
    '3d': '3 Day',
    '5d': '5 Day',
}

// raw model column names -> readable labels. Covers all 37 features in
// ml/training/features.py's _FEATURE_COLS; raw name stays as fallback only
// for genuinely unmapped/unexpected features.
const FEATURE_DISPLAY_NAMES = {
    Close: 'Closing Price',
    Volume: 'Trading Volume',
    RSI14: 'RSI (14-day)',
    MACD: 'MACD',
    MACD_Signal: 'MACD Signal Line',
    Distance_SMA20: 'Distance from 20-day SMA',
    Distance_EMA20: 'Distance from 20-day EMA',
    BB_Width: 'Bollinger Band Width',
    Return_1D: '1-Day Return',
    Return_5D: '5-Day Return',
    Return_10D: '10-Day Return',
    Volume_Ratio_20: 'Volume vs 20-day Average',
    SPY_Return_1D: 'S&P 500 Return (1-Day)',
    SPY_Return_5D: 'S&P 500 Return (5-Day)',
    SPY_Distance_SMA20: 'S&P 500 Momentum (vs 20-Day Average)',
    Relative_Return_1D: 'Performance vs S&P 500 (1-Day)',
    Relative_Return_5D: 'Performance vs S&P 500 (5-Day)',
    Relative_Return_10D: 'Performance vs S&P 500 (10-Day)',
    Volatility_5: '5-Day Volatility',
    Volatility_20: '20-Day Volatility',
    Intraday_Range: 'Intraday Price Range',
    Gap_Return: 'Overnight Price Gap',
    Body_Size: 'Candle Body Size',
    Upper_Shadow: 'Upper Wick (Rejected Highs)',
    Lower_Shadow: 'Lower Wick (Rejected Lows)',
    VIX_Close: 'VIX (Market Volatility)',
    VIX_Return_1D: 'VIX Change (1-Day)',
    VIX_Return_5D: 'VIX Change (5-Day)',
    Treasury_10Y: '10-Year Treasury Yield',
    Treasury_Return_1D: 'Treasury Yield Change (1-Day)',
    DXY_Close: 'US Dollar Index',
    DXY_Return_1D: 'US Dollar Index (1-Day Change)',
    Oil_Close: 'Oil Price',
    Oil_Return_1D: 'Oil Price Change (1-Day)',
    Oil_Return_5D: 'Oil Price Change (5-Day)',
    NASDAQ_Return_1D: 'Nasdaq Performance (1-Day)',
    NASDAQ_Return_5D: 'Nasdaq Performance (5-Day)',
}

function displayFeatureName(feature) {
    return FEATURE_DISPLAY_NAMES[feature] || feature
}

function formatFeatureList(names) {
    if (names.length === 0) return ''
    if (names.length === 1) return names[0]
    return `${names[0]} and ${names[1]}`
}

// Builds one plain-language sentence from the actual top positive/negative
// SHAP features for this specific prediction - nothing about which features
// appear is hardcoded, only the sentence templates below.
function buildShapSummary(sortedShap) {
    if (!sortedShap || sortedShap.length === 0) return null

    const positives = sortedShap.filter((item) => item.impact > 0).slice(0, 2)
    const negatives = sortedShap.filter((item) => item.impact < 0).slice(0, 2)
    const posNames = positives.map((item) => displayFeatureName(item.feature))
    const negNames = negatives.map((item) => displayFeatureName(item.feature))

    if (posNames.length > 0 && negNames.length > 0) {
        return `This prediction was mainly pulled down by ${formatFeatureList(negNames)}, while ${formatFeatureList(posNames)} provided some support.`
    }
    if (posNames.length > 0) {
        return `This prediction was primarily driven by ${formatFeatureList(posNames)}.`
    }
    if (negNames.length > 0) {
        return `This prediction was primarily weighed down by ${formatFeatureList(negNames)}.`
    }
    return null
}

function ViewPrediction({ predData }) {
    const shapExplanation = [...(predData?.shapExplanation || [])].sort(
        (a, b) => Math.abs(b.impact) - Math.abs(a.impact)
    )
    const hasShap = shapExplanation.length > 0
    const maxAbsImpact = hasShap
        ? Math.max(...shapExplanation.map((item) => Math.abs(item.impact)))
        : 0
    const shapSummary = hasShap ? buildShapSummary(shapExplanation) : null

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

                    {hasShap ? (
                        <>
                            {shapSummary && <p className="shap-summary">{shapSummary}</p>}
                            <div className="pred-section-heading">How each factor influenced this prediction</div>
                            <div className="shap-chart">
                                {shapExplanation.map((item) => {
                                    const pct = maxAbsImpact > 0 ? (Math.abs(item.impact) / maxAbsImpact) * 100 : 0
                                    const positive = item.impact >= 0
                                    return (
                                        <div className="shap-row" key={item.feature}>
                                            <div className="shap-label">
                                                {displayFeatureName(item.feature)}
                                            </div>
                                            <div className="shap-bar-track">
                                                <div
                                                    className={'shap-bar-fill ' + (positive ? 'shap-positive' : 'shap-negative')}
                                                    style={{ width: pct + '%' }}
                                                />
                                            </div>
                                            <div className={'shap-value ' + (positive ? 'shap-positive-text' : 'shap-negative-text')}>
                                                {positive ? '+' : ''}{item.impact.toFixed(3)}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    ) : (
                        <p className="shap-unavailable">Explanation unavailable for this prediction.</p>
                    )}

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
