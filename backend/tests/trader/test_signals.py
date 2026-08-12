"""
Trader test cases T-5 through T-7 and T-9:
  T-5  View Trader Dashboard (overview — signals + clients combined)
  T-6  View Signals for Review
  T-7  Endorse Signal
  T-9  View Endorsement History
"""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from tests.trader.conftest import TRADER_HEADERS

client = TestClient(app)

SAMPLE_SIGNAL = {
    "id": "sig1",
    "trader_id": "trader1",
    "investor_id": "inv1",
    "ticker": "AAPL",
    "signal": "Buy",
    "confidence_score": 72.5,
    "reasoning": "Strong momentum",
    "verdict": None,
    "note": None,
    "endorsed_at": None,
    "created_at": "2026-08-01T10:00:00",
    "investor_name": "John Doe",
}

REVIEWED_SIGNAL = {
    **SAMPLE_SIGNAL,
    "id": "sig2",
    "ticker": "MSFT",
    "signal": "Sell",
    "verdict": "agree",
    "note": "Confirmed downtrend",
    "endorsed_at": "2026-08-02T14:00:00",
}


# ---------------------------------------------------------------------------
# T-5  View Trader Dashboard (overview)
# ---------------------------------------------------------------------------
class TestUC5DashboardOverview:
    def test_T_5_BB_returns_signals_and_clients(self):
        """Dashboard loads both signals and clients data."""
        with patch(
            "app.routers.trader.getTraderSignals",
            return_value=[SAMPLE_SIGNAL],
        ):
            r = client.get("/api/trader/signals", headers=TRADER_HEADERS)
        assert r.status_code == 200
        assert "signals" in r.json()

        with patch("app.routers.trader.getTraderClients", return_value=[]):
            r2 = client.get("/api/trader/clients", headers=TRADER_HEADERS)
        assert r2.status_code == 200
        assert "clients" in r2.json()

    def test_T_5_WB_signals_include_investor_name(self):
        """Signal objects contain investor_name from the join."""
        with patch(
            "app.routers.trader.getTraderSignals",
            return_value=[SAMPLE_SIGNAL],
        ):
            r = client.get("/api/trader/signals", headers=TRADER_HEADERS)
        assert r.json()["signals"][0]["investor_name"] == "John Doe"

    def test_T_5_FN_empty_dashboard_returns_empty_lists(self):
        """New trader with no data sees empty lists."""
        with patch("app.routers.trader.getTraderSignals", return_value=[]):
            r = client.get("/api/trader/signals", headers=TRADER_HEADERS)
        assert r.json()["signals"] == []

        with patch("app.routers.trader.getTraderClients", return_value=[]):
            r2 = client.get("/api/trader/clients", headers=TRADER_HEADERS)
        assert r2.json()["clients"] == []


# ---------------------------------------------------------------------------
# T-6  View Signals for Review
# ---------------------------------------------------------------------------
class TestUC6ViewSignals:
    def test_T_6_BB_returns_signal_list(self):
        with patch(
            "app.routers.trader.getTraderSignals",
            return_value=[SAMPLE_SIGNAL, REVIEWED_SIGNAL],
        ):
            r = client.get("/api/trader/signals", headers=TRADER_HEADERS)
        assert r.status_code == 200
        assert len(r.json()["signals"]) == 2

    def test_T_6_WB_ticker_filter_passed_to_service(self):
        with patch(
            "app.routers.trader.getTraderSignals", return_value=[]
        ) as mock_get:
            client.get(
                "/api/trader/signals?ticker=AAPL", headers=TRADER_HEADERS
            )
        args = mock_get.call_args
        assert args[0][1] == "AAPL"  # ticker param

    def test_T_6_FN_signals_contain_required_fields(self):
        with patch(
            "app.routers.trader.getTraderSignals",
            return_value=[SAMPLE_SIGNAL],
        ):
            r = client.get("/api/trader/signals", headers=TRADER_HEADERS)
        sig = r.json()["signals"][0]
        for field in ("id", "ticker", "signal", "confidence_score"):
            assert field in sig


# ---------------------------------------------------------------------------
# T-7  Endorse Signal
# ---------------------------------------------------------------------------
class TestUC7EndorseSignal:
    def test_T_7_BB_invalid_endorsement_rejected(self):
        """Endorsement value other than 'agree'/'disagree' → 400."""
        from fastapi import HTTPException

        with patch(
            "app.routers.trader.endorseSignal",
            side_effect=HTTPException(
                status_code=400,
                detail="Endorsement must be 'agree' or 'disagree'",
            ),
        ):
            r = client.post(
                "/api/trader/signals/endorse",
                json={
                    "signal_id": "sig1",
                    "endorsement": "maybe",
                    "notes": "",
                },
                headers=TRADER_HEADERS,
            )
        assert r.status_code == 400

    def test_T_7_WB_signal_not_found_returns_404(self):
        from fastapi import HTTPException

        with patch(
            "app.routers.trader.endorseSignal",
            side_effect=HTTPException(
                status_code=404, detail="Signal not found"
            ),
        ):
            r = client.post(
                "/api/trader/signals/endorse",
                json={
                    "signal_id": "nonexistent",
                    "endorsement": "agree",
                },
                headers=TRADER_HEADERS,
            )
        assert r.status_code == 404

    def test_T_7_FN_agree_endorsement_saved(self):
        result = {
            "id": "sig1",
            "verdict": "agree",
            "note": "Looks good",
            "endorsed_at": "2026-08-10T12:00:00",
        }
        with patch(
            "app.routers.trader.endorseSignal", return_value=result
        ):
            r = client.post(
                "/api/trader/signals/endorse",
                json={
                    "signal_id": "sig1",
                    "endorsement": "agree",
                    "notes": "Looks good",
                },
                headers=TRADER_HEADERS,
            )
        assert r.status_code == 200
        assert r.json()["endorsement"]["verdict"] == "agree"


# ---------------------------------------------------------------------------
# T-9  View Endorsement History
# ---------------------------------------------------------------------------
class TestUC9EndorsementHistory:
    def test_T_9_BB_returns_endorsement_list(self):
        with patch(
            "app.routers.trader.getTraderEndorsements",
            return_value=[REVIEWED_SIGNAL],
        ):
            r = client.get(
                "/api/trader/endorsements", headers=TRADER_HEADERS
            )
        assert r.status_code == 200
        assert len(r.json()["endorsements"]) == 1

    def test_T_9_WB_only_reviewed_signals_included(self):
        """Service returns only signals where verdict is not null."""
        with patch(
            "app.routers.trader.getTraderEndorsements",
            return_value=[REVIEWED_SIGNAL],
        ):
            r = client.get(
                "/api/trader/endorsements", headers=TRADER_HEADERS
            )
        for e in r.json()["endorsements"]:
            assert e["verdict"] is not None

    def test_T_9_FN_limit_param_respected(self):
        with patch(
            "app.routers.trader.getTraderEndorsements", return_value=[]
        ) as mock_get:
            client.get(
                "/api/trader/endorsements?limit=5", headers=TRADER_HEADERS
            )
        assert mock_get.call_args[0][1] == 5
