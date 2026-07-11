function AddStock({ ticker, onChange, searchResults, showDropdown, onSelect, onAdd, selectedFromSearch }) {
    return (
        <div className="add-form">
            <div className="search-wrap">
                <input
                    value={ticker}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Search ticker or company..."
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
            <button
                className="btn-add"
                onClick={onAdd}
                style={{ opacity: selectedFromSearch ? 1 : 0.5 }}
            >
                + Add Stock
            </button>
        </div>
    )
}

export default AddStock
