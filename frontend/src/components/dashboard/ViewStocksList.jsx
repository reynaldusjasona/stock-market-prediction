function ViewStocksList({ stockList, navigate }) {
    return (
        <>
            <h2 className="section-heading">Stock List</h2>
            <div className="stock-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Ticker</th>
                            <th>Company</th>
                            <th>Exchange</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stockList.slice(0, 6).map((stock) => (
                            <tr
                                key={stock.ticker}
                                onClick={() => navigate(`/stock/${stock.ticker}`)}
                                style={{ cursor: 'pointer' }}
                            >
                                <td>{stock.ticker}</td>
                                <td>{stock.company_name}</td>
                                <td>{stock.exchange}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    )
}

export default ViewStocksList
