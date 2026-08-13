from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestNotifications:
    def test_get_notifications_success(self):
        mock_notifications = [
            {
                "id": "n1",
                "title": "Price Alert Triggered",
                "message": "AAPL crossed $190",
                "is_read": False,
            }
        ]
        with patch(
            "app.services.notification_service.getNotifications",
            return_value=mock_notifications,
        ):
            r = client.get("/api/notifications")
        assert r.status_code == 200
        assert r.json()[0]["id"] == "n1"

    def test_get_notifications_filtered_by_timeframe(self):
        with patch(
            "app.services.notification_service.getNotifications", return_value=[]
        ) as mock_get:
            r = client.get("/api/notifications?timeframe=week")
        assert r.status_code == 200
        args = mock_get.call_args[0]
        assert args[2] == "week"

    def test_get_my_questions_success(self):
        mock_result = {
            "inquiries": [
                {
                    "id": "i1",
                    "ticker": "AAPL",
                    "message": "Thoughts on AAPL?",
                    "response": "Looks strong long-term.",
                    "status": "answered",
                }
            ]
        }
        with patch(
            "app.services.investor_service.getOwnStockInquiries",
            return_value=mock_result,
        ):
            r = client.get("/api/investor/stock-inquiries")
        assert r.status_code == 200
        assert r.json()["inquiries"][0]["ticker"] == "AAPL"

    def test_get_my_questions_empty_when_none_sent(self):
        with patch(
            "app.services.investor_service.getOwnStockInquiries",
            return_value={"inquiries": []},
        ):
            r = client.get("/api/investor/stock-inquiries")
        assert r.status_code == 200
        assert r.json()["inquiries"] == []
