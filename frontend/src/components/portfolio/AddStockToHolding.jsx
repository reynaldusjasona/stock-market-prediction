function AddStockToHolding({
    ticker, onTickerChange, searchResults, showDropdown, onSelect, selectedFromSearch,
    shares, setShares, avgPrice, setAvgPrice, onAdd,
}) {
    return (
        <div className="add-holding-form">
            <div className="search-wrap">
                <input
                    value={ticker}
                    onChange={(e) => onTickerChange(e.target.value)}
                    placeholder="Ticker e.g. AAPL"
                />
                {showDropdown && searchResults.length > 0 && (
                    <div className="search-dropdown">
                        {searchResults.map((stock) => (
                            <div
                                key={stock.ticker}
                                className="search-item"
                                onClick={() => onSelect(stock.ticker)}
                            >
                                <span className="search-ticker">{stock.ticker}</span>
                                <span className="search-name">{stock.company_name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <input
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="Shares"
                type="number"
            />
            <input
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                placeholder="Avg buy price"
                type="number"
            />
            <button
                className="btn-add-holding"
                onClick={onAdd}
                style={{ opacity: selectedFromSearch ? 1 : 0.5 }}
            >
                + Add Stock to Holdings
            </button>
        </div>
    )
}

export default AddStockToHolding
