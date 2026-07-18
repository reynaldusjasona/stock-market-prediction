function ViewOrderBook({ orderBook }) {
    return (
        <div className="tab-content">
            {orderBook ? (
                <div className="orderbook-cols">
                    <div className="orderbook-col">
                        <h3>Bids</h3>
                        {(orderBook.bids || []).map((b, i) => (
                            <div className="orderbook-row bid-row" key={i}>
                                <span>{b.price}</span>
                                <span>{b.size}</span>
                            </div>
                        ))}
                    </div>
                    <div className="orderbook-col">
                        <h3>Asks</h3>
                        {(orderBook.asks || []).map((a, i) => (
                            <div className="orderbook-row ask-row" key={i}>
                                <span>{a.price}</span>
                                <span>{a.size}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <p>No order book data available</p>
            )}
        </div>
    )
}

export default ViewOrderBook
