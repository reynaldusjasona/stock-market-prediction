import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api/api'
import '../../styles/AppLayout.css'

const NAV_LINKS = [
    { label: 'Dashboard', path: '/dashboard', trader: true },
    { label: 'All Stocks', path: '/allstocks', trader: true },
    { label: 'Recommendations', path: '/recommendations' },
    { label: 'Browse Traders', path: '/browse-traders' },
    { label: 'Watchlist', path: '/watchlist' },
    { label: 'Portfolio', path: '/portfolio' },
    { label: 'Alerts', path: '/alerts' },
    { label: 'Notifications', path: '/notifications', trader: true },
    { label: 'Feedback', path: '/feedback', trader: true },
]

// pages an unsubscribed investor must still be able to reach - otherwise
// there's no way to get to the Subscribe button at all
const EXEMPT_PATHS = ['/account', '/subscription']

function AppLayout({ children }) {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, isSubscribed, subscriptionLoaded, logout } = useAuth()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [showResults, setShowResults] = useState(false)
    const [showProfileMenu, setShowProfileMenu] = useState(false)

    // isSubscribed already covers traders (bypass built into AuthContext),
    // so no separate role check is needed here
    const isLocked = subscriptionLoaded && !isSubscribed && !EXEMPT_PATHS.includes(location.pathname)
    const searchDisabled = !subscriptionLoaded || isLocked

    function handleLogout() {
        logout()
        navigate('/login')
    }

    async function handleSearchChange(value) {
        setQuery(value)
        if (searchDisabled || value.length < 1) {
            setResults([])
            setShowResults(false)
            return
        }
        try {
            const data = await api.get(`/stocks/search?q=${encodeURIComponent(value)}`)
            setResults(data)
            setShowResults(true)
        } catch (err) {
            console.log('search failed:', err.message)
        }
    }

    function goToStock(ticker) {
        setQuery('')
        setResults([])
        setShowResults(false)
        navigate(`/stock/${ticker}`)
    }

    const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?'
    const isTrader = user?.role === 'trader'
    const navLinks = isTrader ? NAV_LINKS.filter((link) => link.trader) : NAV_LINKS

    return (
        <div className="app-shell">
            <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="sidebar-logo">StockWise <span>AI</span></div>
                {navLinks.map((link) => (
                    <span
                        key={link.path}
                        className={location.pathname === link.path ? 'sidebar-link active' : 'sidebar-link'}
                        onClick={() => navigate(link.path)}
                    >
                        {link.label}
                    </span>
                ))}

                {!isTrader && (
                    <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
                )}

                {isTrader && (
                    <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
                        <span className="sidebar-link" onClick={() => navigate('/trader/dashboard')}>
                            &#8592; Back to Trader Portal
                        </span>
                        <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
                    </div>
                )}
            </aside>
            <div className="app-main">
                <div className="topbar">
                    <div className="topbar-search">
                        <input
                            type="text"
                            placeholder={searchDisabled ? 'Subscribe to search stocks' : 'Search stock by name or ticker'}
                            value={query}
                            disabled={searchDisabled}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onFocus={() => results.length > 0 && setShowResults(true)}
                            onBlur={() => setTimeout(() => setShowResults(false), 150)}
                        />
                        {!searchDisabled && showResults && results.length > 0 && (
                            <div className="topbar-search-dropdown">
                                {results.map((r) => (
                                    <div
                                        key={r.ticker}
                                        className="topbar-search-item"
                                        onMouseDown={() => goToStock(r.ticker)}
                                    >
                                        <span className="topbar-search-ticker">{r.ticker}</span>
                                        <span className="topbar-search-name">{r.company_name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {location.pathname === '/dashboard' && (
                        <div className="topbar-nav">
                            <span onClick={() => document.getElementById('market-overview')?.scrollIntoView({ behavior: 'smooth' })}>
                                Market Overview
                            </span>
                            <span onClick={() => document.getElementById('stock-list')?.scrollIntoView({ behavior: 'smooth' })}>
                                Stock List
                            </span>
                        </div>
                    )}
                    <div className="topbar-actions">
                        <span
                            className="topbar-bell"
                            title="Notifications"
                            onClick={() => navigate('/notifications')}
                        >
                            &#128276;
                        </span>
                        <div className="topbar-profile">
                            <div
                                className="topbar-profile-trigger"
                                onClick={() => setShowProfileMenu((v) => !v)}
                            >
                                <span className="topbar-avatar">{initial}</span>
                                <span className="topbar-username">{user?.name || 'Account'} &#9662;</span>
                            </div>
                            {showProfileMenu && (
                                <div className="topbar-profile-menu">
                                    <span onClick={() => { setShowProfileMenu(false); navigate('/account') }}>Account</span>
                                    <span onClick={handleLogout}>Logout</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <main className="main-content">
                    {!subscriptionLoaded ? null : isLocked ? (
                        <div className="page-lock-container">
                            <div className="page-lock-blurred">{children}</div>
                            <div className="page-lock-overlay">
                                <div className="page-lock-card">
                                    <div className="page-lock-icon">🔒</div>
                                    <h3>Subscribe to unlock StockWise AI</h3>
                                    <p>Subscribe to the Investor Plan to access your dashboard, stock data, watchlist, portfolio, and every other feature.</p>
                                    <button className="btn-unlock" onClick={() => navigate('/subscription')}>
                                        Subscribe to Unlock
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : children}
                </main>
            </div>
        </div>
    )
}

export default AppLayout
