import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import { formatPrice } from '../utils/format'
import '../styles/Watchlist.css'
import AddStock from '../components/watchlist/AddStock'
import RemoveStock from '../components/watchlist/RemoveStock'

function Watchlist() {
    const [watchlist, setWatchlist] = useState([])
    const [ticker, setTicker] = useState('')
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(true)
    const [searchResults, setSearchResults] = useState([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedFromSearch, setSelectedFromSearch] = useState(false)
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const isTrader = user?.role === 'trader'

    function handleLogout() {
        logout()
        navigate('/login')
    }

    useEffect(() => {
        getMyStocks()
    }, [])

    // load stocks in watchlist
    async function getMyStocks() {
        try {
            const data = await api.get('/watchlist')
            setWatchlist(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // add stock to watchlist - only if picked from search
    async function addStock() {
        if (!ticker || !selectedFromSearch) return
        try {
            await api.post(`/watchlist/${ticker.toUpperCase()}`)
            setTicker('')
            setSelectedFromSearch(false)
            getMyStocks()
        } catch (err) {
            setError(err.message)
        }
    }

    // delete stock from watchlist
    async function removeStock(tickerToRemove) {
        try {
            await api.delete(`/watchlist/${tickerToRemove}`)
            getMyStocks()
        } catch (err) {
            setError(err.message)
        }
    }

    // search stocks as user types
    async function searchStocks(query) {
        setTicker(query)
        setSelectedFromSearch(false)
        if (query.length < 1) {
            setSearchResults([])
            setShowDropdown(false)
            return
        }
        try {
            const results = await api.get(`/stocks/search?q=${query}`)
            setSearchResults(results)
            setShowDropdown(true)
        } catch (err) {
            console.log('search failed:', err.message)
        }
    }

    // when user picks from dropdown
    function selectStock(selectedTicker) {
        setTicker(selectedTicker)
        setSelectedFromSearch(true)
        setShowDropdown(false)
        setSearchResults([])
    }

    if (loading) return <p>Loading...</p>

    return (
        <div className="watchlist-page">
                                                <aside className="sidebar">
                <div className="sidebar-logo">StockWise <span>AI</span></div>

                {/* Both roles */}
                <span className="sidebar-link" onClick={() => navigate('/dashboard')}>Dashboard</span>
                <span className="sidebar-link" onClick={() => navigate('/allstocks')}>All Stocks</span>
                <span className="sidebar-link" onClick={() => navigate('/notifications')}>Notifications</span>
                <span className="sidebar-link" onClick={() => navigate('/feedback')}>Feedback</span>

                {/* Investor only */}
                {!isTrader && (
                    <>
                        <span className="sidebar-link" onClick={() => navigate('/recommendations')}>Recommendations</span>
                        <span className="sidebar-link active" onClick={() => navigate('/watchlist')}>Watchlist</span>
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

            <div className="watchlist-content">
                <div className="watchlist-header">
                    <div>
                        <h1>Watchlist</h1>
                        <p>{watchlist.length} stocks tracked in your primary list</p>
                    </div>
                </div>

                {error && <p className="error-msg">{error}</p>}

                <AddStock
                    ticker={ticker}
                    onChange={searchStocks}
                    searchResults={searchResults}
                    showDropdown={showDropdown}
                    onSelect={selectStock}
                    onAdd={addStock}
                    selectedFromSearch={selectedFromSearch}
                />

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Ticker</th>
                                <th>Company Name</th>
                                <th>Price</th>
                                <th>Change %</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {watchlist.map((item) => (
                                <tr key={item.id} onClick={() => navigate(`/stock/${item.ticker}`)} style={{ cursor: 'pointer' }}>
                                    <td className="ticker-cell">{item.ticker}</td>
                                    <td>{item.company_name || '-'}</td>
                                    <td>{item.current_price !== null && item.current_price !== undefined ? `$${formatPrice(item.current_price)}` : '-'}</td>
                                    <td>
                                        {item.change_percent !== null && item.change_percent !== undefined ? (
                                            <span className={item.change_percent >= 0 ? 'change-positive' : 'change-negative'}>
                                                {item.change_percent >= 0 ? '+' : ''}{formatPrice(item.change_percent)}%
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <RemoveStock ticker={item.ticker} onRemove={removeStock} />
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

export default Watchlist