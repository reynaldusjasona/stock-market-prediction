import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import '../styles/Portfolio.css'
import ViewHoldingsDetails from '../components/portfolio/ViewHoldingsDetails'
import AddStockToHolding from '../components/portfolio/AddStockToHolding'

function Portfolio() {
    const [holdings, setHoldings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [ticker, setTicker] = useState('')
    const [shares, setShares] = useState('')
    const [avgPrice, setAvgPrice] = useState('')
    const [liveprices, setLivePrices] = useState({})
    const [totalValue, setTotalValue] = useState(0)
    const [totalGainLoss, setTotalGainLoss] = useState(0)
    const { logout } = useAuth()
    const navigate = useNavigate()

    function handleLogout() {
        logout()
        navigate('/login')
    }

    useEffect(() => {
        loadPortfolio()
    }, [])

    // get all holdings
    async function loadPortfolio() {
        try {
            const data = await api.get('/portfolio')
            setHoldings(data)
            fetchLivePrices(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // get the current price for each holding so we can show market value / gain-loss
    async function fetchLivePrices(holdingsList) {
        const prices = {}
        for (const item of holdingsList) {
            try {
                const data = await api.get('/stocks/' + item.ticker)
                prices[item.ticker] = data.current_price
            } catch (err) {
                console.log('price fetch failed for', item.ticker)
                prices[item.ticker] = null
            }
        }
        setLivePrices(prices)
        // calculate totals
        let total = 0
        let gainloss = 0
        holdingsList.forEach(item => {
            const price = prices[item.ticker]
            if (price) {
                total += item.shares * price
                gainloss += (price - item.average_buy_price) * item.shares
            }
        })
        setTotalValue(total)
        setTotalGainLoss(gainloss)
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
                <span className="sidebar-link" onClick={() => navigate('/allstocks')}>All Stocks</span>
                <span className="sidebar-link" onClick={() => navigate('/recommendations')}>Recommendations</span>
                <span className="sidebar-link" onClick={() => navigate('/watchlist')}>Watchlist</span>
                <span className="sidebar-link active">Portfolio</span>
                <span className="sidebar-link" onClick={() => navigate('/alerts')}>Alerts</span>
                <span className="sidebar-link" onClick={() => navigate('/notifications')}>Notifications</span>
                <span className="sidebar-link" onClick={() => navigate('/feedback')}>Feedback</span>
                <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
            </aside>

            <div className="portfolio-content">
                <div className="portfolio-header">
                    <h1>Portfolio</h1>
                    <p>Overview of your current holdings</p>
                </div>

                {error && <p className="error-msg">{error}</p>}

                <div className="portfolio-stats">
                    <div className="stat-card">
                        <p className="stat-label">Total Portfolio Value</p>
                        <p className="stat-value">${totalValue.toFixed(2)}</p>
                    </div>
                    <div className="stat-card">
                        <p className="stat-label">Total Gain/Loss</p>
                        <p className={totalGainLoss >= 0 ? 'stat-value positive' : 'stat-value negative'}>
                            {totalGainLoss >= 0 ? '+' : ''}${totalGainLoss.toFixed(2)}
                        </p>
                    </div>
                    <div className="stat-card">
                        <p className="stat-label">Number of Holdings</p>
                        <p className="stat-value">{holdings.length} Stocks</p>
                    </div>
                </div>

                <AddStockToHolding
                    ticker={ticker}
                    setTicker={setTicker}
                    shares={shares}
                    setShares={setShares}
                    avgPrice={avgPrice}
                    setAvgPrice={setAvgPrice}
                    onAdd={addHolding}
                />

                <ViewHoldingsDetails holdings={holdings} livePrices={liveprices} onRemove={removeHolding} />
            </div>
        </div>
    )
}

export default Portfolio