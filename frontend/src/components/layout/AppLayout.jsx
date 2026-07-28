import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api/api'
import '../../styles/AppLayout.css'

const NAV_LINKS = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'All Stocks', path: '/allstocks' },
    { label: 'Recommendations', path: '/recommendations' },
    { label: 'Browse Traders', path: '/browse-traders' },
    { label: 'Watchlist', path: '/watchlist' },
    { label: 'Portfolio', path: '/portfolio' },
    { label: 'Alerts', path: '/alerts' },
    { label: 'Notifications', path: '/notifications' },
    { label: 'Feedback', path: '/feedback' },
]

function AppLayout({ children }) {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout } = useAuth()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [showResults, setShowResults] = useState(false)
    const [showProfileMenu, setShowProfileMenu] = useState(false)

    function handleLogout() {
        logout()
        navigate('/login')
    }

    async function handleSearchChange(value) {
        setQuery(value)
        if (value.length < 1) {
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

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="sidebar-logo">StockWise <span>AI</span></div>
                {NAV_LINKS.map((link) => (
                    <span
                        key={link.path}
                        className={location.pathname === link.path ? 'sidebar-link active' : 'sidebar-link'}
                        onClick={() => navigate(link.path)}
                    >
                        {link.label}
                    </span>
                ))}
                <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
            </aside>

            <div className="app-main">
                <div className="topbar">
                    <div className="topbar-search">
                        <input
                            type="text"
                            placeholder="Search stock by name or ticker"
                            value={query}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onFocus={() => results.length > 0 && setShowResults(true)}
                            onBlur={() => setTimeout(() => setShowResults(false), 150)}
                        />
                        {showResults && results.length > 0 && (
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

                <main className="main-content">{children}</main>
            </div>
        </div>
    )
}

export default AppLayout
