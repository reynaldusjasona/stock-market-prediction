function ViewTopGainersLosers({ gainers, losers, fmt, navigate }) {
    return (
        <div className="market-box">
            <h3>Top Gainers & Losers</h3>
            {gainers.map((stock) => (
                <div
                    className="ticker-row"
                    key={stock.ticker}
                    onClick={() => navigate(`/stock/${stock.ticker}`)}
                    style={{ cursor: 'pointer' }}
                >
                    <span className="ticker-symbol">{stock.ticker}</span>
                    <span className="ticker-price">${fmt(stock.price)}</span>
                    <span className="change-positive">+{fmt(stock.change_percent)}%</span>
                </div>
            ))}
            {losers.map((stock) => (
                <div
                    className="ticker-row"
                    key={stock.ticker}
                    onClick={() => navigate(`/stock/${stock.ticker}`)}
                    style={{ cursor: 'pointer' }}
                >
                    <span className="ticker-symbol">{stock.ticker}</span>
                    <span className="ticker-price">${fmt(stock.price)}</span>
                    <span className="change-negative">{fmt(stock.change_percent)}%</span>
                </div>
            ))}
        </div>
    )
}

export default ViewTopGainersLosers
