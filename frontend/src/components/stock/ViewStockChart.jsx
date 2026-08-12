import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import { calculateSMA, calculateEMA, calculateRSI, calculateMACD } from '../../utils/indicators'

const timeframes = ['1D', '1W', '1M', '3M']
const INDICATORS = [
    { value: 'none', label: 'No Indicator' },
    { value: 'sma', label: 'MA' },
    { value: 'ema', label: 'EMA' },
    { value: 'rsi', label: 'RSI' },
    { value: 'macd', label: 'MACD' },
]
const DEFAULT_PERIOD = { sma: 20, ema: 20, rsi: 14 }

// groups daily candles into bigger candles depending on the chosen interval
function aggregateCandles(dailyData, interval) {
    if (interval === '1D') {
        // no aggregation needed, daily data as is
        return dailyData
    }
    const groups = {}
    dailyData.forEach(candle => {
        const date = new Date(candle.time)
        let groupKey
        if (interval === '1W') {
            // group by week - get Monday of that week
            const day = date.getDay()
            const monday = new Date(date)
            monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
            groupKey = monday.toISOString().split('T')[0]
        } else if (interval === '1M') {
            // group by month
            groupKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-01'
        } else if (interval === '3M') {
            // group by quarter
            const quarter = Math.floor(date.getMonth() / 3)
            groupKey = date.getFullYear() + '-Q' + (quarter + 1)
            // normalize to first month of quarter
            const firstMonth = quarter * 3
            groupKey = date.getFullYear() + '-' + String(firstMonth + 1).padStart(2, '0') + '-01'
        }
        if (!groups[groupKey]) {
            groups[groupKey] = {
                time: groupKey,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            }
        } else {
            // update high and low
            groups[groupKey].high = Math.max(groups[groupKey].high, candle.high)
            groups[groupKey].low = Math.min(groups[groupKey].low, candle.low)
            // close is always the last candle's close
            groups[groupKey].close = candle.close
        }
    })
    return Object.values(groups).sort((a, b) => a.time.localeCompare(b.time))
}

function ViewStockChart({ chartData, activeInterval, onIntervalChange }) {
    const containerRef = useRef(null)
    const chartRef = useRef(null)
    const seriesRef = useRef(null)
    const indicatorSeriesRef = useRef([])

    const [indicatorType, setIndicatorType] = useState('none')
    const [period, setPeriod] = useState(DEFAULT_PERIOD.sma)

    function handleIndicatorChange(type) {
        setIndicatorType(type)
        if (DEFAULT_PERIOD[type]) setPeriod(DEFAULT_PERIOD[type])
    }

    // create the chart once on mount
    useEffect(() => {
        const chart = createChart(containerRef.current, {
            layout: { background: { color: '#0d0e12' }, textColor: '#888' },
            grid: {
                vertLines: { color: '#1a1b20' },
                horzLines: { color: '#1a1b20' },
            },
            width: containerRef.current.clientWidth,
            height: 400,
        })

        const series = chart.addSeries(CandlestickSeries, {
            upColor: '#00ff41',
            downColor: '#ff4444',
            borderUpColor: '#00ff41',
            borderDownColor: '#ff4444',
            wickUpColor: '#00ff41',
            wickDownColor: '#ff4444',
        })

        chartRef.current = chart
        seriesRef.current = series

        function handleResize() {
            chart.applyOptions({ width: containerRef.current.clientWidth })
        }
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            chart.remove()
        }
    }, [])

    // rebuild the candles whenever the raw data or the chosen interval changes,
    // then layer the selected indicator on top of the same displayed candles
    useEffect(() => {
        if (!seriesRef.current || !chartRef.current) return

        // raw backend rows use "date" - normalize to the { time, open, high, low, close } shape
        const dailyCandles = chartData
            .map((item) => ({
                time: item.date,
                open: Number(item.open),
                high: Number(item.high),
                low: Number(item.low),
                close: Number(item.close),
            }))
            .sort((a, b) => (a.time > b.time ? 1 : -1))

        const displayData = aggregateCandles(dailyCandles, activeInterval)
        seriesRef.current.setData(displayData)

        // clear any indicator series left over from the previous
        // type/period/interval before adding the new selection
        indicatorSeriesRef.current.forEach((s) => chartRef.current.removeSeries(s))
        indicatorSeriesRef.current = []

        const chart = chartRef.current
        if (indicatorType === 'sma' || indicatorType === 'ema') {
            const points = indicatorType === 'sma'
                ? calculateSMA(displayData, period)
                : calculateEMA(displayData, period)
            const line = chart.addSeries(LineSeries, { color: '#ffcc00', lineWidth: 2 })
            line.setData(points)
            indicatorSeriesRef.current.push(line)
        } else if (indicatorType === 'rsi') {
            const points = calculateRSI(displayData, period)
            const line = chart.addSeries(LineSeries, {
                color: '#60a5fa',
                lineWidth: 2,
                priceScaleId: 'rsi',
            })
            chart.priceScale('rsi').applyOptions({
                scaleMargins: { top: 0.75, bottom: 0.02 },
            })
            line.setData(points)
            indicatorSeriesRef.current.push(line)
        } else if (indicatorType === 'macd') {
            const { macdLine, signalLine, histogram } = calculateMACD(displayData)
            const macd = chart.addSeries(LineSeries, {
                color: '#00ff41',
                lineWidth: 2,
                priceScaleId: 'macd',
            })
            const signal = chart.addSeries(LineSeries, {
                color: '#ff4444',
                lineWidth: 2,
                priceScaleId: 'macd',
            })
            const hist = chart.addSeries(HistogramSeries, {
                color: '#888',
                priceScaleId: 'macd',
            })
            chart.priceScale('macd').applyOptions({
                scaleMargins: { top: 0.75, bottom: 0.02 },
            })
            macd.setData(macdLine)
            signal.setData(signalLine)
            hist.setData(histogram)
            indicatorSeriesRef.current.push(macd, signal, hist)
        }
    }, [chartData, activeInterval, indicatorType, period])

    return (
        <div className="tab-content">
            <div className="chart-timeframes">
                {timeframes.map((tf) => (
                    <span
                        key={tf}
                        className={activeInterval === tf ? 'timeframe-btn active' : 'timeframe-btn'}
                        onClick={() => onIntervalChange(tf)}
                    >
                        {tf}
                    </span>
                ))}

                <div className="chart-indicator-controls">
                    <select
                        className="indicator-select"
                        value={indicatorType}
                        onChange={(e) => handleIndicatorChange(e.target.value)}
                    >
                        {INDICATORS.map((ind) => (
                            <option key={ind.value} value={ind.value}>{ind.label}</option>
                        ))}
                    </select>
                    {indicatorType !== 'none' && indicatorType !== 'macd' && (
                        <input
                            type="number"
                            className="indicator-period-input"
                            min={2}
                            max={200}
                            value={period}
                            onChange={(e) => setPeriod(Math.max(2, Number(e.target.value) || 2))}
                        />
                    )}
                </div>
            </div>

            <div ref={containerRef} style={{ width: '100%', height: '400px' }} />
        </div>
    )
}

export default ViewStockChart
