function ViewTrendingTickers({ trendList, fmt }) {
    return (
        <div className="market-box">
            <h3>Trending Tickers</h3>
            {trendList.map((stock) => (
                <div className="ticker-row" key={stock.ticker}>
                    <span className="ticker-symbol">{stock.ticker}</span>
                    <span className="ticker-price">${fmt(stock.current_price)}</span>
                    <span className={stock.change_percent >= 0 ? 'change-positive' : 'change-negative'}>
                        {stock.change_percent >= 0 ? '+' : ''}{fmt(stock.change_percent)}%
                    </span>
                </div>
            ))}
        </div>
    )
}

export default ViewTrendingTickers
