import RemoveStockFromHolding from './RemoveStockFromHolding'

function ViewHoldingsDetails({ holdings, livePrices, onRemove }) {
    return (
        <div className="holdings-table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Ticker</th>
                        <th>Shares</th>
                        <th>Avg Cost</th>
                        <th>Current Price</th>
                        <th>Market Value</th>
                        <th>Total Gain/Loss</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {holdings.map((item) => {
                        const currentPrice = livePrices[item.ticker]
                        const marketValue = currentPrice ? item.shares * currentPrice : null
                        const gainLoss = currentPrice ? (currentPrice - item.average_buy_price) * item.shares : null
                        return (
                            <tr key={item.id}>
                                <td className="ticker-cell">{item.ticker}</td>
                                <td>{item.shares}</td>
                                <td>${Number(item.average_buy_price).toFixed(2)}</td>
                                <td>{currentPrice ? '$' + Number(currentPrice).toFixed(2) : 'Loading...'}</td>
                                <td>{marketValue ? '$' + marketValue.toFixed(2) : '-'}</td>
                                <td className={gainLoss >= 0 ? 'positive' : 'negative'}>
                                    {gainLoss ? (gainLoss >= 0 ? '+' : '') + '$' + gainLoss.toFixed(2) : '-'}
                                </td>
                                <td>
                                    <RemoveStockFromHolding ticker={item.ticker} onRemove={onRemove} />
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

export default ViewHoldingsDetails
