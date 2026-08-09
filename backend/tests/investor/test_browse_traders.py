# GET /investor/traders (app/routers/investor.py -> investor_service.listApprovedTraders)
# is intentionally NOT covered here. It's a second, signal-access-gated
# trader-listing endpoint that duplicates GET /traders below, but grepping
# the frontend turned up no caller for it (BrowseTraders.jsx uses GET /traders
# exclusively) - confirmed unused/dead code, flagged for a future removal
# discussion rather than tested as if it were live.
from unittest.mock import patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user

client = TestClient(app)

_MOCK_TRADER = {
    "id": "trader1",
    "sub": "trader1",
    "email": "trader@test.com",
    "role": "trader",
}


class TestBrowseTraders:
    def test_browse_traders_success(self):
        mock_traders = [
            {"id": "t1", "name": "Alex Trader", "license_number": "MAS12345"}
        ]
        with patch(
            "app.routers.traders.getApprovedTraders", return_value=mock_traders
        ):
            r = client.get("/api/traders")
        assert r.status_code == 200
        assert r.json()["traders"][0]["id"] == "t1"

    def test_browse_traders_non_investor_returns_403(self):
        app.dependency_overrides[get_current_user] = lambda: _MOCK_TRADER
        r = client.get("/api/traders")
        assert r.status_code == 403

    def test_connect_to_trader_success(self):
        with patch(
            "app.services.investor_service.engageTrader",
            return_value={
                "message": "Trader engaged successfully",
                "engagement": {"id": "e1", "trader_id": "t1", "status": "active"},
            },
        ):
            r = client.post("/api/investor/engagements", json={"trader_id": "t1"})
        assert r.status_code == 200

    def test_connect_no_signal_access_returns_403(self):
        with patch(
            "app.services.investor_service.engageTrader",
            side_effect=HTTPException(
                status_code=403,
                detail="Subscribe to Signal Access ($19.99/mo) to view "
                "trader recommendations.",
            ),
        ):
            r = client.post("/api/investor/engagements", json={"trader_id": "t1"})
        assert r.status_code == 403

    def test_connect_trader_not_found_returns_404(self):
        with patch(
            "app.services.investor_service.engageTrader",
            side_effect=HTTPException(status_code=404, detail="Trader not found."),
        ):
            r = client.post(
                "/api/investor/engagements", json={"trader_id": "nonexistent"}
            )
        assert r.status_code == 404

    def test_connect_while_already_engaged_elsewhere_returns_409(self):
        with patch(
            "app.services.investor_service.engageTrader",
            side_effect=HTTPException(
                status_code=409,
                detail="You're already connected to a trader — disconnect "
                "first to connect with someone else.",
            ),
        ):
            r = client.post("/api/investor/engagements", json={"trader_id": "t2"})
        assert r.status_code == 409

    def test_get_own_engagement_success(self):
        mock_result = {
            "engagements": [
                {
                    "id": "e1",
                    "trader_id": "t1",
                    "status": "active",
                    "trader": {"id": "t1", "name": "Alex Trader"},
                }
            ]
        }
        with patch(
            "app.services.investor_service.getOwnEngagement",
            return_value=mock_result,
        ):
            r = client.get("/api/investor/engagements/me")
        assert r.status_code == 200
        assert r.json()["engagements"][0]["trader_id"] == "t1"

    def test_disconnect_success(self):
        with patch(
            "app.services.investor_service.endEngagement",
            return_value={"message": "Engagement ended."},
        ):
            r = client.delete("/api/investor/engagements/e1")
        assert r.status_code == 200

    def test_disconnect_not_found_returns_404(self):
        with patch(
            "app.services.investor_service.endEngagement",
            side_effect=HTTPException(
                status_code=404, detail="Engagement not found."
            ),
        ):
            r = client.delete("/api/investor/engagements/nonexistent")
        assert r.status_code == 404

    def test_ask_trader_success(self):
        with patch(
            "app.services.investor_service.createStockInquiry",
            return_value={
                "message": "Question sent to trader.",
                "inquiry": {"id": "i1", "ticker": "AAPL"},
            },
        ):
            r = client.post(
                "/api/investor/stock-inquiries",
                json={
                    "trader_id": "t1",
                    "ticker": "AAPL",
                    "message": "Thoughts on AAPL?",
                },
            )
        assert r.status_code == 200

    def test_ask_trader_not_connected_returns_403(self):
        with patch(
            "app.services.investor_service.createStockInquiry",
            side_effect=HTTPException(
                status_code=403, detail="You are not connected with this trader."
            ),
        ):
            r = client.post(
                "/api/investor/stock-inquiries",
                json={"trader_id": "t9", "ticker": "AAPL"},
            )
        assert r.status_code == 403
