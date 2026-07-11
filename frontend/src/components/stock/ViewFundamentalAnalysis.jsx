function ViewFundamentalAnalysis({ fundData, formatNum, formatLarge }) {
    return (
        <div className="tab-content">
            {fundData ? (
                <div className="fund-grid">
                    <div className="fund-box"><span className="fund-label">Market Cap</span><span className="fund-value">{formatLarge(fundData.market_cap)}</span></div>
                    <div className="fund-box"><span className="fund-label">P/E Ratio</span><span className="fund-value">{formatNum(fundData.pe_ratio)}</span></div>
                    <div className="fund-box"><span className="fund-label">Forward P/E</span><span className="fund-value">{formatNum(fundData.forward_pe)}</span></div>
                    <div className="fund-box"><span className="fund-label">EPS</span><span className="fund-value">{formatNum(fundData.eps)}</span></div>
                    <div className="fund-box"><span className="fund-label">Revenue</span><span className="fund-value">{formatLarge(fundData.revenue)}</span></div>
                    <div className="fund-box"><span className="fund-label">Profit Margin</span><span className="fund-value">{formatNum(fundData.profit_margin)}</span></div>
                    <div className="fund-box"><span className="fund-label">Dividend Yield</span><span className="fund-value">{formatNum(fundData.dividend_yield)}</span></div>
                    <div className="fund-box"><span className="fund-label">52W High</span><span className="fund-value">{formatNum(fundData.week52_high)}</span></div>
                    <div className="fund-box"><span className="fund-label">52W Low</span><span className="fund-value">{formatNum(fundData.week52_low)}</span></div>
                    <div className="fund-box"><span className="fund-label">Beta</span><span className="fund-value">{formatNum(fundData.beta)}</span></div>
                    <div className="fund-box"><span className="fund-label">Sector</span><span className="fund-value">{fundData.sector}</span></div>
                    <div className="fund-box"><span className="fund-label">Industry</span><span className="fund-value">{fundData.industry}</span></div>
                </div>
            ) : (
                <p>No fundamental data available</p>
            )}
        </div>
    )
}

export default ViewFundamentalAnalysis
