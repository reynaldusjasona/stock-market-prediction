import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { formatPrice as formatNum } from '../utils/format'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/layout/AppLayout'
import '../styles/Dashboard.css'
import '../styles/StockDetail.css'
import ViewStockChart from '../components/stock/ViewStockChart'
import ViewNews from '../components/stock/ViewNews'
import ViewPrediction from '../components/stock/ViewPrediction'
import ViewFundamentalAnalysis from '../components/stock/ViewFundamentalAnalysis'

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
    const { user, isSubscribed, hasSignalAccess } = useAuth()

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
    const [activeInterval, setActiveInterval] = useState('1D')

    // Ask Trader
    const [engagements, setEngagements] = useState([])
    const [showAskModal, setShowAskModal] = useState(false)
    const [selectedTraderId, setSelectedTraderId] = useState('')
    const [askMessage, setAskMessage] = useState('')
    const [askError, setAskError] = useState(null)
    const [askSuccess, setAskSuccess] = useState(null)
    const [asking, setAsking] = useState(false)

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
        if (!isSubscribed) {
            setLoading(false)
            return
        }
        loadStockData()
        loadHistory()
    }, [ticker, isSubscribed])

    // pull the investor's connected traders so we know whether "Ask Trader"
    // can go straight to a single trader or needs a picker
    useEffect(() => {
        if (user?.role !== 'investor' || !hasSignalAccess) return
        api.get('/investor/engagements/me')
            .then((data) => setEngagements(data.engagements || []))
            .catch((err) => console.log('engagements failed:', err.message))
    }, [user?.role, hasSignalAccess])

    function openAskModal() {
        setAskError(null)
        setAskSuccess(null)
        setAskMessage('')
        setSelectedTraderId(engagements[0]?.trader_id || '')
        setShowAskModal(true)
    }

    async function handleSendInquiry() {
        if (!selectedTraderId) {
            setAskError('Select a trader.')
            return
        }
        setAsking(true)
        setAskError(null)
        try {
            await api.post('/investor/stock-inquiries', {
                trader_id: selectedTraderId,
                ticker,
                message: askMessage.trim() || undefined,
            })
            setShowAskModal(false)
            setAskSuccess(`Sent ${ticker} to your trader.`)
        } catch (err) {
            setAskError(err.message)
        } finally {
            setAsking(false)
        }
    }

    if (loading) return <p>Loading...</p>

    const isUp = stockInfo && stockInfo.change_percent >= 0

    return (
        <AppLayout>
            <>
                <div className="page-header">
                    <div className="page-header-top">
                        <span className="back-link" onClick={() => navigate('/dashboard')}>&larr; Back</span>
                        {user?.role === 'investor' && (
                            !hasSignalAccess ? (
                                <button className="btn-browse-traders" onClick={() => navigate('/subscription')}>
                                    Subscribe to Ask a Trader
                                </button>
                            ) : engagements.length === 0 ? (
                                <button className="btn-browse-traders" onClick={() => navigate('/browse-traders')}>
                                    Connect with a Trader
                                </button>
                            ) : (
                                <button className="btn-browse-traders" onClick={openAskModal}>
                                    Ask Trader
                                </button>
                            )
                        )}
                    </div>
                    {askSuccess && <p className="success-msg">{askSuccess}</p>}
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
                    {['Chart', 'News', 'Prediction', 'Fundamental'].map((tab) => (
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
                {activeTab === 'Prediction' && <ViewPrediction predData={predData} />}

                {/* fundamental tab */}
                {activeTab === 'Fundamental' && (
                    <ViewFundamentalAnalysis fundData={fundData} formatNum={formatNum} formatLarge={formatLarge} />
                )}

                {showAskModal && (
                    <div className="ask-trader-overlay" onClick={() => setShowAskModal(false)}>
                        <div className="ask-trader-modal" onClick={(e) => e.stopPropagation()}>
                            <h3>Ask about {ticker}</h3>
                            {askError && <p className="error-msg">{askError}</p>}
                            {engagements.length > 1 && (
                                <div className="form-group">
                                    <label>Trader</label>
                                    <select value={selectedTraderId} onChange={(e) => setSelectedTraderId(e.target.value)}>
                                        {engagements.map((e) => (
                                            <option key={e.trader_id} value={e.trader_id}>
                                                {e.trader?.name || e.trader_id}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {engagements.length === 1 && (
                                <p className="subtitle">To {engagements[0].trader?.name || 'your trader'}</p>
                            )}
                            <div className="form-group">
                                <label>Message (optional)</label>
                                <textarea
                                    rows={3}
                                    placeholder={`What would you like to ask about ${ticker}?`}
                                    value={askMessage}
                                    onChange={(e) => setAskMessage(e.target.value)}
                                />
                            </div>
                            <div className="ask-trader-actions">
                                <button className="btn-secondary" onClick={() => setShowAskModal(false)}>Cancel</button>
                                <button className="btn-primary" onClick={handleSendInquiry} disabled={asking}>
                                    {asking ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        </AppLayout>
    )
}

export default StockDetail
