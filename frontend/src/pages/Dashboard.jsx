import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import { formatPrice as fmt } from '../utils/format'
import '../styles/Dashboard.css'
import ViewTrendingTickers from '../components/dashboard/ViewTrendingTickers'
import ViewTopGainersLosers from '../components/dashboard/ViewTopGainersLosers'
import ViewStocksList from '../components/dashboard/ViewStocksList'

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
                <span className="sidebar-link" onClick={() => navigate('/allstocks')}>All Stocks</span>
                <span className="sidebar-link" onClick={() => navigate('/recommendations')}>Recommendations</span>
                <span className="sidebar-link" onClick={() => navigate('/watchlist')}>Watchlist</span>
                <span className="sidebar-link" onClick={() => navigate('/portfolio')}>Portfolio</span>
                <span className="sidebar-link" onClick={() => navigate('/alerts')}>Alerts</span>
                <span className="sidebar-link" onClick={() => navigate('/notifications')}>Notifications</span>
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
                    <ViewTrendingTickers trendList={trendList} fmt={fmt} />
                    <ViewTopGainersLosers gainers={gainers} losers={losers} fmt={fmt} />
                </div>

                <ViewStocksList stockList={stockList} navigate={navigate} fmt={fmt} />
            </div>
        </div>
    )
}
export default Dashboard