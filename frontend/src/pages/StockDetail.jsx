import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { formatPrice as formatNum } from '../utils/format'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/layout/AppLayout'
import LockedFeature from '../components/LockedFeature'
import '../styles/Dashboard.css'
import '../styles/StockDetail.css'
import ViewStockChart from '../components/stock/ViewStockChart'
import ViewNews from '../components/stock/ViewNews'
import ViewPrediction from '../components/stock/ViewPrediction'
import ViewFundamentalAnalysis from '../components/stock/ViewFundamentalAnalysis'
import ViewOrderBook from '../components/stock/ViewOrderBook'

function formatLarge(num) {
    if (!num) return 'N/A'
    if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + 'T'
    if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B'
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M'
    return '$' + Number(num).toFixed(2)
}

function StockDetail() {
    const { ticker } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()

    // states in kind of a random order lol
    const [activeTab, setActiveTab] = useState('Chart')
    const [predData, setPredData] = useState(null)
    const [stockInfo, setStockInfo] = useState(null)
    const [loading, setLoading] = useState(true)
    const [newsItems, setNewsItems] = useState([])
    const [newsLoading, setNewsLoading] = useState(true)
    const [newsError, setNewsError] = useState(null)
    const [fundData, setFundData] = useState(null)
    const [historyData, setHistoryData] = useState([])
    const [orderBookData, setOrderBookData] = useState(null)
    const [activeInterval, setActiveInterval] = useState('1D')

    // switch between tabs
    function switchTab(tabName) {
        setActiveTab(tabName)
    }

    // load stock data - fetch each thing separately so one failing doesnt break the rest
    async function loadStockData() {
        try {
            const info = await api.get(`/stocks/${ticker}`)
            setStockInfo(info)
        } catch (err) {
            console.log('stock info failed:', err.message)
        }

        try {
            setNewsLoading(true)
            setNewsError(null)
            const news = await api.get(`/news/${ticker}`)
            setNewsItems(news)
        } catch (err) {
            console.log('news failed:', err.message)
            setNewsError(err.message || 'Failed to load news.')
        } finally {
            setNewsLoading(false)
        }

        try {
            const pred = await api.get(`/predictions/${ticker}`)
            setPredData(pred)
        } catch (err) {
            console.log('prediction failed:', err.message)
        }

        try {
            const fund = await api.get(`/stocks/${ticker}/fundamentals`)
            setFundData(fund)
        } catch (err) {
            console.log('fundamentals failed:', err.message)
        }

        try {
            const ob = await api.get(`/stocks/${ticker}/orderbook`)
            setOrderBookData(ob)
        } catch (err) {
            console.log('orderbook failed:', err.message)
        }

        setLoading(false)
    }

    // always grab a full year of daily candles - the chart aggregates them
    // into weekly/monthly/quarterly candles on the frontend, so no refetch needed
    async function loadHistory() {
        try {
            const hist = await api.get(`/stocks/${ticker}/history?period=1Y`)
            setHistoryData(hist)
        } catch (err) {
            console.log('history failed:', err.message)
        }
    }

    useEffect(() => {
        loadStockData()
        loadHistory()
    }, [ticker])

    if (loading) return <p>Loading...</p>

    const isUp = stockInfo && stockInfo.change_percent >= 0

    return (
        <AppLayout>
            <>
                <div className="page-header">
                    <div className="page-header-top">
                        <span className="back-link" onClick={() => navigate('/dashboard')}>&larr; Back</span>
                        {user?.role === 'investor' && (
                            <button className="btn-browse-traders" onClick={() => navigate('/browse-traders')}>
                                Browse Traders
                            </button>
                        )}
                    </div>
                    <h1>{ticker}</h1>
                    {stockInfo && (
                        <div className="stock-header-stats">
                            <span className="stock-price-big">${formatNum(stockInfo.current_price)}</span>
                            <span className={isUp ? 'change-positive' : 'change-negative'}>
                                {isUp ? '+' : ''}{formatNum(stockInfo.change)} ({isUp ? '+' : ''}{formatNum(stockInfo.change_percent)}%)
                            </span>
                            <span className="stat-item">Open: {formatNum(stockInfo.open)}</span>
                            <span className="stat-item">High: {formatNum(stockInfo.high)}</span>
                            <span className="stat-item">Low: {formatNum(stockInfo.low)}</span>
                            <span className="stat-item">Vol: {stockInfo.volume}</span>
                        </div>
                    )}
                </div>

                {/* tab bar */}
                <div className="tab-bar">
                    {['Chart', 'News', 'Prediction', 'Fundamental', 'OrderBook'].map((tab) => (
                        <span
                            key={tab}
                            className={activeTab === tab ? 'tab-item active' : 'tab-item'}
                            onClick={() => switchTab(tab)}
                        >
                            {tab}
                        </span>
                    ))}
                </div>

                {/* chart tab */}
                {activeTab === 'Chart' && (
                    <ViewStockChart chartData={historyData} activeInterval={activeInterval} onIntervalChange={setActiveInterval} />
                )}

                {/* news tab */}
                {activeTab === 'News' && (
                    newsLoading ? (
                        <p>Loading news...</p>
                    ) : newsError ? (
                        <p className="error-msg">{newsError}</p>
                    ) : newsItems.length === 0 ? (
                        <p>No recent news for {ticker}.</p>
                    ) : (
                        <ViewNews newsItems={newsItems} />
                    )
                )}

                {/* prediction tab */}
                {activeTab === 'Prediction' && (
                    <LockedFeature
                        title="AI Predictions"
                        description="Subscribe to unlock AI-powered Buy / Hold / Sell predictions for this stock."
                    >
                        <ViewPrediction predData={predData} />
                    </LockedFeature>
                )}

                {/* fundamental tab */}
                {activeTab === 'Fundamental' && (
                    <ViewFundamentalAnalysis fundData={fundData} formatNum={formatNum} formatLarge={formatLarge} />
                )}

                {/* order book tab */}
                {activeTab === 'OrderBook' && <ViewOrderBook orderBook={orderBookData} />}
            </>
        </AppLayout>
    )
}

export default StockDetail
