import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import '../styles/Alerts.css'

function Alerts() {
    const [alerts, setAlerts] = useState([])
    const [loading, setLoading] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [ticker, setTicker] = useState('')
    const [targetPrice, setTargetPrice] = useState('')
    const [condition, setCondition] = useState('above')
    const [searchResults, setSearchResults] = useState([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedTicker, setSelectedTicker] = useState('')
    const [editingId, setEditingId] = useState(null)
    const [editPrice, setEditPrice] = useState('')
    const [editCondition, setEditCondition] = useState('above')
    const [error, setError] = useState(null)
    const { logout } = useAuth()
    const navigate = useNavigate()

    function handleLogout() {
        logout()
        navigate('/login')
    }

    // fetch trending to get tickers, then fetch alerts for each
    async function loadAlerts() {
        setLoading(true)
        try {
            const trending = await api.get('/stocks/trending')
            let allAlerts = []
            for (const stock of trending) {
                try {
                    const tickerAlerts = await api.get('/alerts/' + stock.ticker)
                    if (Array.isArray(tickerAlerts)) {
                        allAlerts = [...allAlerts, ...tickerAlerts]
                    }
                } catch (e) {
                    // no alerts for this ticker, skip
                }
            }
            setAlerts(allAlerts)
        } catch (err) {
            console.log('load alerts failed:', err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAlerts()
    }, [])

    // search function - same pattern as watchlist
    async function searchTickers(query) {
        setTicker(query)
        setSelectedTicker('')
        if (query.length < 1) { setSearchResults([]); setShowDropdown(false); return }
        try {
            const results = await api.get('/stocks/search?q=' + query)
            setSearchResults(results)
            setShowDropdown(true)
        } catch (err) {
            console.log('search failed')
        }
    }

    function selectTicker(t) {
        setTicker(t)
        setSelectedTicker(t)
        setShowDropdown(false)
        setSearchResults([])
    }

    // create alert
    async function createAlert() {
        if (!selectedTicker || !targetPrice) return
        try {
            await api.post('/alerts/' + selectedTicker, {
                target_price: parseFloat(targetPrice),
                condition: condition
            })
            setShowForm(false)
            setTicker('')
            setTargetPrice('')
            setSelectedTicker('')
            loadAlerts()
        } catch (err) {
            setError(err.message)
        }
    }

    // delete alert
    async function deleteAlert(alertId) {
        try {
            await api.delete('/alerts/' + alertId)
            loadAlerts()
        } catch (err) {
            setError(err.message)
        }
    }

    // edit alert
    async function saveEdit(alertId) {
        try {
            await api.patch('/alerts/' + alertId, {
                new_price: parseFloat(editPrice),
                alert_type: editCondition
            })
            setEditingId(null)
            loadAlerts()
        } catch (err) {
            setError(err.message)
        }
    }

    return (
        <div className="alerts-page">
            <aside className="sidebar">
                <div className="sidebar-logo">StockWise <span>AI</span></div>
                <span className="sidebar-link" onClick={() => navigate('/dashboard')}>Dashboard</span>
                <span className="sidebar-link" onClick={() => navigate('/allstocks')}>All Stocks</span>
                <span className="sidebar-link" onClick={() => navigate('/recommendations')}>Recommendations</span>
                <span className="sidebar-link" onClick={() => navigate('/watchlist')}>Watchlist</span>
                <span className="sidebar-link" onClick={() => navigate('/portfolio')}>Portfolio</span>
                <span className="sidebar-link active">Alerts</span>
                <span className="sidebar-link" onClick={() => navigate('/notifications')}>Notifications</span>
                <span className="sidebar-link" onClick={() => navigate('/feedback')}>Feedback</span>
                <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
            </aside>
            <div className="alerts-content">
                <div className="alerts-header">
                    <div>
                        <h1>Alerts</h1>
                        <p>Get notified when your conditions are met</p>
                    </div>
                    <button className="btn-create-alert" onClick={() => setShowForm(!showForm)}>
                        + Create Alert
                    </button>
                </div>

                {showForm && (
                    <div className="alert-form">
                        <div className="search-wrap">
                            <input value={ticker} onChange={(e) => searchTickers(e.target.value)} placeholder="Search ticker..." />
                            {showDropdown && searchResults.length > 0 && (
                                <div className="search-dropdown">
                                    {searchResults.map(s => (
                                        <div key={s.ticker} className="search-item" onClick={() => selectTicker(s.ticker)}>
                                            <span className="search-ticker">{s.ticker}</span>
                                            <span className="search-name">{s.company_name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="Target price" />
                        <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                            <option value="above">Price Above</option>
                            <option value="below">Price Below</option>
                        </select>
                        <button className="btn-create-alert" onClick={createAlert} style={{ opacity: selectedTicker ? 1 : 0.5 }}>Save Alert</button>
                        <button className="btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                )}

                {error && <p className="error-msg">{error}</p>}

                <div className="alerts-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Ticker</th>
                                <th>Condition</th>
                                <th>Target Price</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && alerts.length === 0 && (
                                <tr><td colSpan="5" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No alerts yet. Create one above.</td></tr>
                            )}
                            {alerts.map(alert => (
                                <tr key={alert.id}>
                                    <td className="ticker-cell">{alert.ticker}</td>
                                    <td>Price {alert.condition} ${Number(alert.target_price).toFixed(2)}</td>
                                    <td>${Number(alert.target_price).toFixed(2)}</td>
                                    <td>
                                        <span className={alert.is_triggered ? 'badge-triggered' : 'badge-active'}>
                                            {alert.is_triggered ? 'Triggered' : 'Active'}
                                        </span>
                                    </td>
                                    <td>
                                        {editingId === alert.id ? (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} style={{ width: '100px' }} />
                                                <select value={editCondition} onChange={(e) => setEditCondition(e.target.value)}>
                                                    <option value="above">Above</option>
                                                    <option value="below">Below</option>
                                                </select>
                                                <button onClick={() => saveEdit(alert.id)} className="btn-save">Save</button>
                                                <button onClick={() => setEditingId(null)} className="btn-cancel">Cancel</button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn-edit" onClick={() => { setEditingId(alert.id); setEditPrice(alert.target_price); setEditCondition(alert.condition) }}>✏️</button>
                                                <button className="btn-delete" onClick={() => deleteAlert(alert.id)}>🗑️</button>
                                            </div>
                                        )}
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

export default Alerts
