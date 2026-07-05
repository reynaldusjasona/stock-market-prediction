import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import '../styles/Dashboard.css'

function Dashboard() {
    const [trendList, setTrendList] = useState([])
    const [gainers, setGainers] = useState([])
    const [losers, setLosers] = useState([])
    const [stockList, setStockList] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    // logout and go back to login
    function handleLogout() {
        logout()
        navigate('/login')
    }

    // get all data needed for dashboard
    async function getData() {
        try {
            const trendData = await api.get('/stocks/trending')
            setTrendList(trendData)
        } catch (err) {
            console.log('trending failed:', err.message)
        }

        try {
            const moverData = await api.get('/stocks/movers')
            setGainers(moverData.gainers || [])
            setLosers(moverData.losers || [])
        } catch (err) {
            console.log('movers failed:', err.message)
        }

        try {
            const allStocks = await api.get('/stocks')
            setStockList(allStocks)
        } catch (err) {
            console.log('stocks failed:', err.message)
        }

        setLoading(false)
    }

    useEffect(() => {
        getData()
    }, [])

    if (loading) return <p>Loading...</p>
    if (error) return <p>{error}</p>


    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-logo">StockWise <span>AI</span></div>
                <span className="sidebar-link active">Dashboard</span>
                <span className="sidebar-link" onClick={() => navigate('/watchlist')}>Watchlist</span>
                <span className="sidebar-link" onClick={() => navigate('/portfolio')}>Portfolio</span>
                <span className="sidebar-link" onClick={() => navigate('/feedback')}>Feedback</span>
                <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
            </aside>
    
            <div className="main-content">
                <div className="page-header">
                    <h1>Welcome back, Investor</h1>
                    <p>Market analysis is updated and ready for your next move.</p>
                </div>
    
                <h2 className="section-heading">Market Overview</h2>
    
                <div className="market-grid">
                    <div className="market-box">
                        <h3>Trending Tickers</h3>
                        {trendList.map((stock) => (
                            <div className="ticker-row" key={stock.ticker}>
                                <span className="ticker-symbol">{stock.ticker}</span>
                                <span className="ticker-price">${stock.current_price}</span>
                                <span className={stock.change_percent >= 0 ? 'change-positive' : 'change-negative'}>
                                    {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent}%
                                </span>
                            </div>
                        ))}
                    </div>
    
                    <div className="market-box">
                        <h3>Top Gainers & Losers</h3>
                        {gainers.map((stock) => (
                            <div className="ticker-row" key={stock.ticker}>
                                <span className="ticker-symbol">{stock.ticker}</span>
                                <span className="ticker-price">${stock.price}</span>
                                <span className="change-positive">+{stock.change_percent}%</span>
                            </div>
                        ))}
                        {losers.map((stock) => (
                            <div className="ticker-row" key={stock.ticker}>
                                <span className="ticker-symbol">{stock.ticker}</span>
                                <span className="ticker-price">${stock.price}</span>
                                <span className="change-negative">{stock.change_percent}%</span>
                            </div>
                        ))}
                    </div>
                </div>
    
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
                                <tr key={stock.ticker}>
                                    <td>{stock.ticker}</td>
                                    <td>{stock.company_name}</td>
                                    <td>{stock.exchange}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
export default Dashboard