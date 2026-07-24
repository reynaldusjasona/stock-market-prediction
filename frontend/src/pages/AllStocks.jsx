import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import '../styles/AllStocks.css'
import ViewStocksList from '../components/allstocks/ViewStocksList'

function AllStocks() {
    const [stocks, setStocks] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const isTrader = user?.role === 'trader'

    function handleLogout() {
        logout()
        navigate('/login')
    }

    // no search yet - just show trending stocks
    async function loadTrending() {
        try {
            const data = await api.get('/stocks/trending')
            setStocks(data)
        } catch (err) {
            console.log('trending failed:', err.message)
        }
        setLoading(false)
    }

    // search by ticker or company name
    async function runSearch(query) {
        try {
            const data = await api.get(`/stocks/search?q=${query}`)
            setStocks(data)
        } catch (err) {
            console.log('search failed:', err.message)
        }
        setLoading(false)
    }

    useEffect(() => {
        if (!searchQuery) {
            loadTrending()
        } else {
            runSearch(searchQuery)
        }
    }, [searchQuery])

    if (loading) return <p>Loading...</p>

    return (
        <div className="allstocks-page">
                                                <aside className="sidebar">
                <div className="sidebar-logo">StockWise <span>AI</span></div>

                {/* Both roles */}
                <span className="sidebar-link" onClick={() => navigate('/dashboard')}>Dashboard</span>
                <span className="sidebar-link active" onClick={() => navigate('/allstocks')}>All Stocks</span>
                <span className="sidebar-link" onClick={() => navigate('/notifications')}>Notifications</span>
                <span className="sidebar-link" onClick={() => navigate('/feedback')}>Feedback</span>

                {/* Investor only */}
                {!isTrader && (
                    <>
                        <span className="sidebar-link" onClick={() => navigate('/recommendations')}>Recommendations</span>
                        <span className="sidebar-link" onClick={() => navigate('/watchlist')}>Watchlist</span>
                        <span className="sidebar-link" onClick={() => navigate('/portfolio')}>Portfolio</span>
                        <span className="sidebar-link" onClick={() => navigate('/alerts')}>Alerts</span>
                        <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
                    </>
                )}

                {/* Trader — Back to Trader Portal + Logout pinned to bottom */}
                {isTrader && (
                    <div style={{ marginTop:'auto', borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'0.5rem' }}>
                        <span className="sidebar-link" onClick={() => navigate('/trader/dashboard')}>
                            ← Back to Trader Portal
                        </span>
                        <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
                    </div>
                )}
            </aside>

            <div className="allstocks-content">
                <div className="allstocks-header">
                    <h1>All Stocks</h1>
                    <p>Browse and search every stock we track</p>
                </div>

                <input
                    className="stock-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ticker or company..."
                />

                <ViewStocksList stocks={stocks} navigate={navigate} />
            </div>
        </div>
    )
}

export default AllStocks
