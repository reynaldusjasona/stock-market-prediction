import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import '../styles/Portfolio.css'

function Portfolio() {
    const [holdings, setHoldings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [ticker, setTicker] = useState('')
    const [shares, setShares] = useState('')
    const [avgPrice, setAvgPrice] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        loadPortfolio()
    }, [])

    // get all holdings
    async function loadPortfolio() {
        try {
            const data = await api.get('/portfolio')
            setHoldings(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // add new holding
    async function addHolding() {
        if (!ticker || !shares || !avgPrice) return
        try {
            await api.post('/portfolio', {
                ticker: ticker.toUpperCase(),
                shares: parseFloat(shares),
                average_buy_price: parseFloat(avgPrice)
            })
            setTicker('')
            setShares('')
            setAvgPrice('')
            loadPortfolio()
        } catch (err) {
            setError(err.message)
        }
    }

    // remove holding
    async function removeHolding(symbol) {
        try {
            await api.delete(`/portfolio/${symbol}`)
            loadPortfolio()
        } catch (err) {
            setError(err.message)
        }
    }

    if (loading) return <p>Loading...</p>

    return (
        <div className="portfolio-page">
            <aside className="sidebar">
                <div className="sidebar-logo">StockWise <span>AI</span></div>
                <span className="sidebar-link" onClick={() => navigate('/dashboard')}>Dashboard</span>
                <span className="sidebar-link" onClick={() => navigate('/watchlist')}>Watchlist</span>
                <span className="sidebar-link active">Portfolio</span>
                <span className="sidebar-link" onClick={() => navigate('/feedback')}>Feedback</span>
            </aside>

            <div className="portfolio-content">
                <div className="portfolio-header">
                    <h1>Portfolio</h1>
                    <p>Overview of your current holdings</p>
                </div>

                {error && <p className="error-msg">{error}</p>}

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
                    <button className="btn-add-holding" onClick={addHolding}>+ Add Stock to Holdings</button>
                </div>

                <div className="holdings-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Ticker</th>
                                <th>Shares</th>
                                <th>Avg Buy Price</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holdings.map((item) => (
                                <tr key={item.id}>
                                    <td className="ticker-cell">{item.ticker}</td>
                                    <td>{item.shares}</td>
                                    <td>${item.average_buy_price}</td>
                                    <td>
                                        <button className="btn-remove" onClick={() => removeHolding(item.ticker)}>
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default Portfolio