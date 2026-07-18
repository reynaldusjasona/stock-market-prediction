function AddStockToHolding({ ticker, setTicker, shares, setShares, avgPrice, setAvgPrice, onAdd }) {
    return (
        <div className="add-holding-form">
            <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="Ticker e.g. AAPL"
            />
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
            <button className="btn-add-holding" onClick={onAdd}>+ Add Stock to Holdings</button>
        </div>
    )
}

export default AddStockToHolding
