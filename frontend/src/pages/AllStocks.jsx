import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import AppLayout from '../components/layout/AppLayout'
import '../styles/AllStocks.css'
import ViewStocksList from '../components/allstocks/ViewStocksList'

function AllStocks() {
    const [stocks, setStocks] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

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
