import { useState } from 'react'
import { api } from '../api/api'
import '../styles/CompleteProfileModal.css'

const MARKET_SECTORS = [
    'Technology',
    'Healthcare',
    'Financial Services',
    'Consumer Cyclical',
    'Consumer Defensive',
    'Energy',
    'Communication Services',
]

const RISK_LEVELS = ['low', 'moderate', 'high']

function CompleteProfileModal({ userID, onDone, onDismiss }) {
    const [riskTolerance, setRiskTolerance] = useState('moderate')
    const [marketsFollowed, setMarketsFollowed] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    function toggleMarket(sector) {
        setMarketsFollowed((prev) =>
            prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
        )
    }

    async function handleSave() {
        setSaving(true)
        setError(null)
        try {
            await Promise.all([
                api.put(`/auth/user/${userID}/risk-tolerance`, { level: riskTolerance }),
                api.put(`/auth/user/${userID}/preferences`, { preferences: marketsFollowed }),
            ])
            onDone()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay">
            <div className="modal-panel">
                <h2>Complete Your Investing Profile</h2>
                <p className="modal-subtitle">
                    Tell us a bit about your investing style so we can tailor recommendations to you.
                </p>

                {error && <p className="error-msg">{error}</p>}

                <div className="form-group">
                    <label>Risk Tolerance</label>
                    <select value={riskTolerance} onChange={(e) => setRiskTolerance(e.target.value)}>
                        {RISK_LEVELS.map((level) => (
                            <option key={level} value={level}>
                                {level.charAt(0).toUpperCase() + level.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Markets Followed</label>
                    <div className="markets-grid">
                        {MARKET_SECTORS.map((sector) => (
                            <label key={sector} className="market-checkbox">
                                <input
                                    type="checkbox"
                                    checked={marketsFollowed.includes(sector)}
                                    onChange={() => toggleMarket(sector)}
                                />
                                {sector}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="btn-save-profile" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save & Continue'}
                    </button>
                    <button className="btn-later" onClick={onDismiss}>
                        I'll do this later
                    </button>
                </div>
            </div>
        </div>
    )
}

export default CompleteProfileModal
