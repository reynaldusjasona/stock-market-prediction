function CreateAlert({
    ticker,
    onTickerChange,
    searchResults,
    showDropdown,
    onSelectTicker,
    targetPrice,
    setTargetPrice,
    condition,
    setCondition,
    onCreate,
}) {
    return (
        <div className="alert-form">
            <div className="alert-search-wrap">
                <input
                    value={ticker}
                    onChange={(e) => onTickerChange(e.target.value)}
                    placeholder="Search ticker..."
                />
                {showDropdown && searchResults.length > 0 && (
                    <div className="alert-search-dropdown">
                        {searchResults.map((stock) => (
                            <div
                                key={stock.ticker}
                                className="alert-search-item"
                                onClick={() => onSelectTicker(stock.ticker)}
                            >
                                <span>{stock.ticker}</span>
                                <span>{stock.company_name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <input
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Target price"
                type="number"
            />

            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="above">Above</option>
                <option value="below">Below</option>
            </select>

            <button className="btn-create-alert" onClick={onCreate}>
                + Create Alert
            </button>
        </div>
    )
}

export default CreateAlert
