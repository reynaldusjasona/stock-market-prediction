function ViewStocksList({ stocks, navigate }) {
    return (
        <div className="allstocks-table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Ticker</th>
                        <th>Company Name</th>
                        <th>Price</th>
                        <th>Change %</th>
                    </tr>
                </thead>
                <tbody>
                    {stocks.map((stock) => (
                        <tr key={stock.ticker} onClick={() => navigate(`/stock/${stock.ticker}`)}>
                            <td>{stock.ticker}</td>
                            <td>{stock.company_name}</td>
                            <td>{stock.current_price !== undefined ? `$${stock.current_price}` : '-'}</td>
                            <td>
                                {stock.change_percent !== undefined ? (
                                    <span className={stock.change_percent >= 0 ? 'change-positive' : 'change-negative'}>
                                        {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent}%
                                    </span>
                                ) : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export default ViewStocksList
