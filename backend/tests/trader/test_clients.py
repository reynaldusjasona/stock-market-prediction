"""
Trader test cases T-8, T-10, T-11:
  T-8   View Clients
  T-10  View Stock Inquiries
  T-11  Respond to Stock Inquiry
"""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from tests.trader.conftest import TRADER_HEADERS

client = TestClient(app)

SAMPLE_CLIENT = {
    "id": "inv1",
    "full_name": "Jane Investor",
    "email": "jane@test.com",
    "linked_since": "2026-07-15T09:00:00",
}

SAMPLE_INQUIRY = {
    "id": "inq1",
    "investor_id": "inv1",
    "ticker": "TSLA",
    "message": "Should I hold TSLA through earnings?",
    "status": "pending",
    "response": None,
    "responded_at": None,
    "created_at": "2026-08-05T08:00:00",
    "investor_name": "Jane Investor",
}


# ---------------------------------------------------------------------------
# T-8  View Clients
# ---------------------------------------------------------------------------
class TestUC8ViewClients:
    def test_T_8_BB_returns_client_list(self):
        with patch(
            "app.routers.trader.getTraderClients",
            return_value=[SAMPLE_CLIENT],
        ):
            r = client.get("/api/trader/clients", headers=TRADER_HEADERS)
        assert r.status_code == 200
        assert len(r.json()["clients"]) == 1

    def test_T_8_WB_includes_investor_details(self):
        with patch(
            "app.routers.trader.getTraderClients",
            return_value=[SAMPLE_CLIENT],
        ):
            r = client.get("/api/trader/clients", headers=TRADER_HEADERS)
        c = r.json()["clients"][0]
        assert c["full_name"] == "Jane Investor"
        assert c["email"] == "jane@test.com"

    def test_T_8_FN_no_clients_returns_empty(self):
        with patch(
            "app.routers.trader.getTraderClients", return_value=[]
        ):
            r = client.get("/api/trader/clients", headers=TRADER_HEADERS)
        assert r.json()["clients"] == []


# ---------------------------------------------------------------------------
# T-10  View Stock Inquiries
# ---------------------------------------------------------------------------
class TestUC10ViewInquiries:
    def test_T_10_BB_returns_inquiry_list(self):
        with patch(
            "app.routers.trader.getTraderStockInquiries",
            return_value=[SAMPLE_INQUIRY],
        ):
            r = client.get(
                "/api/trader/stock-inquiries", headers=TRADER_HEADERS
            )
        assert r.status_code == 200
        assert len(r.json()["inquiries"]) == 1

    def test_T_10_WB_includes_investor_name(self):
        with patch(
            "app.routers.trader.getTraderStockInquiries",
            return_value=[SAMPLE_INQUIRY],
        ):
            r = client.get(
                "/api/trader/stock-inquiries", headers=TRADER_HEADERS
            )
        assert r.json()["inquiries"][0]["investor_name"] == "Jane Investor"

    def test_T_10_FN_open_and_answered_both_returned(self):
        answered = {
            **SAMPLE_INQUIRY,
            "id": "inq2",
            "status": "answered",
            "response": "Hold through earnings",
            "responded_at": "2026-08-06T10:00:00",
        }
        with patch(
            "app.routers.trader.getTraderStockInquiries",
            return_value=[SAMPLE_INQUIRY, answered],
        ):
            r = client.get(
                "/api/trader/stock-inquiries", headers=TRADER_HEADERS
            )
        statuses = [i["status"] for i in r.json()["inquiries"]]
        assert "pending" in statuses and "answered" in statuses


# ---------------------------------------------------------------------------
# T-11  Respond to Stock Inquiry
# ---------------------------------------------------------------------------
class TestUC11RespondToInquiry:
    def test_T_11_BB_inquiry_not_found_404(self):
        from fastapi import HTTPException

        with patch(
            "app.routers.trader.respondToStockInquiry",
            side_effect=HTTPException(
                status_code=404, detail="Inquiry not found."
            ),
        ):
            r = client.patch(
                "/api/trader/stock-inquiries/nonexistent",
                json={"response": "My advice"},
                headers=TRADER_HEADERS,
            )
        assert r.status_code == 404

    def test_T_11_WB_response_saved_with_status_answered(self):
        result = {
            "id": "inq1",
            "response": "Hold through earnings",
            "status": "answered",
            "responded_at": "2026-08-10T12:00:00",
        }
        with patch(
            "app.routers.trader.respondToStockInquiry",
            return_value=result,
        ) as mock_respond:
            r = client.patch(
                "/api/trader/stock-inquiries/inq1",
                json={"response": "Hold through earnings"},
                headers=TRADER_HEADERS,
            )
        assert r.status_code == 200
        assert mock_respond.call_args[0][2] == "Hold through earnings"

    def test_T_11_FN_successful_response_returns_inquiry(self):
        result = {
            "id": "inq1",
            "response": "Buy the dip",
            "status": "answered",
            "responded_at": "2026-08-10T12:00:00",
        }
        with patch(
            "app.routers.trader.respondToStockInquiry",
            return_value=result,
        ):
            r = client.patch(
                "/api/trader/stock-inquiries/inq1",
                json={"response": "Buy the dip"},
                headers=TRADER_HEADERS,
            )
        assert r.status_code == 200
        assert r.json()["inquiry"]["status"] == "answered"
