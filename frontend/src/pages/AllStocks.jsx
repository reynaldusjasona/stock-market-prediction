import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/layout/AppLayout'
import '../styles/AllStocks.css'
import ViewStocksList from '../components/allstocks/ViewStocksList'

function AllStocks() {
    const [stocks, setStocks] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const { isSubscribed } = useAuth()

    // no search - show every stock we track
    async function loadAllStocks() {
        try {
            const data = await api.get('/stocks')
            setStocks(data)
        } catch (err) {
            console.log('stock list failed:', err.message)
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
        if (!isSubscribed) {
            setLoading(false)
            return
        }
        if (!searchQuery) {
            loadAllStocks()
        } else {
            runSearch(searchQuery)
        }
    }, [searchQuery, isSubscribed])

    if (loading) return <p>Loading...</p>

    return (
        <AppLayout>
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
        </AppLayout>
    )
}

export default AllStocks
