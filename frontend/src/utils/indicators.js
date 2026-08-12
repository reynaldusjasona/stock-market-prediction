// Ported from backend/app/services/stock_service.py's indicator math, so
// values match what the backend already computes for predictions. Unlike
// the backend (which only returns the latest snapshot value), these return
// a full time-aligned series for chart overlay rendering, computed
// client-side from the candle data the chart already has in memory.

function emaSeries(values, period) {
    if (values.length < period) return []
    const k = 2 / (period + 1)
    const series = [values.slice(0, period).reduce((a, b) => a + b, 0) / period]
    for (let i = period; i < values.length; i++) {
        series.push(values[i] * k + series[series.length - 1] * (1 - k))
    }
    return series
}

export function calculateSMA(candles, period) {
    const closes = candles.map((c) => c.close)
    const result = []
    for (let i = period - 1; i < closes.length; i++) {
        const window = closes.slice(i - period + 1, i + 1)
        const avg = window.reduce((a, b) => a + b, 0) / period
        result.push({ time: candles[i].time, value: avg })
    }
    return result
}

export function calculateEMA(candles, period) {
    const closes = candles.map((c) => c.close)
    const series = emaSeries(closes, period)
    if (series.length === 0) return []
    const offset = closes.length - series.length
    return series.map((value, i) => ({ time: candles[offset + i].time, value }))
}

// Wilder's smoothing, same as the backend's rsi14 calculation
export function calculateRSI(candles, period = 14) {
    const closes = candles.map((c) => c.close)
    if (closes.length < period + 1) return []

    const deltas = []
    for (let i = 1; i < closes.length; i++) deltas.push(closes[i] - closes[i - 1])
    const gains = deltas.map((d) => (d > 0 ? d : 0))
    const losses = deltas.map((d) => (d < 0 ? -d : 0))

    const rsiFrom = (gain, loss) => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss))

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

    const result = [{ time: candles[period].time, value: rsiFrom(avgGain, avgLoss) }]

    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period
        result.push({ time: candles[i + 1].time, value: rsiFrom(avgGain, avgLoss) })
    }
    return result
}

export function calculateMACD(candles, fast = 12, slow = 26, signalPeriod = 9) {
    const closes = candles.map((c) => c.close)
    const emaFast = emaSeries(closes, fast)
    const emaSlow = emaSeries(closes, slow)
    if (emaFast.length === 0 || emaSlow.length === 0) {
        return { macdLine: [], signalLine: [], histogram: [] }
    }

    const overlap = emaSlow.length
    const emaFastAligned = emaFast.slice(emaFast.length - overlap)
    const macdValues = emaFastAligned.map((v, i) => v - emaSlow[i])
    const macdOffset = closes.length - overlap

    const signalValues = emaSeries(macdValues, signalPeriod)
    const signalOffset = macdValues.length - signalValues.length

    const macdLine = macdValues.map((value, i) => ({
        time: candles[macdOffset + i].time,
        value,
    }))
    const signalLine = signalValues.map((value, i) => ({
        time: candles[macdOffset + signalOffset + i].time,
        value,
    }))
    const histogram = signalValues.map((sig, i) => ({
        time: candles[macdOffset + signalOffset + i].time,
        value: macdValues[signalOffset + i] - sig,
    }))

    return { macdLine, signalLine, histogram }
}
