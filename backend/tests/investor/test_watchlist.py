from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestWatchlist:
    def test_get_watchlist_success(self):
        mock_watchlist = [
            {
                "ticker": "AAPL",
                "company_name": "Apple Inc.",
                "current_price": 190.5,
                "change_percent": 1.2,
            }
        ]
        with patch(
            "app.services.watchlist_service.getWatchlist",
            return_value=mock_watchlist,
        ):
            r = client.get("/api/watchlist")
        assert r.status_code == 200
        assert r.json()[0]["ticker"] == "AAPL"

    def test_add_to_watchlist_success(self):
        with patch(
            "app.services.watchlist_service.addToWatchlist",
            return_value={"id": "w1", "user_id": "investor1", "ticker": "AAPL"},
        ):
            r = client.post("/api/watchlist/AAPL")
        assert r.status_code == 201

    def test_add_to_watchlist_duplicate_returns_409(self):
        with patch(
            "app.services.watchlist_service.addToWatchlist",
            side_effect=ValueError("Ticker already in watchlist"),
        ):
            r = client.post("/api/watchlist/AAPL")
        assert r.status_code == 409

    def test_remove_from_watchlist_success(self):
        with patch(
            "app.services.watchlist_service.removeFromWatchlist",
            return_value=True,
        ):
            r = client.delete("/api/watchlist/AAPL")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_remove_from_watchlist_not_found_returns_404(self):
        with patch(
            "app.services.watchlist_service.removeFromWatchlist",
            return_value=False,
        ):
            r = client.delete("/api/watchlist/AAPL")
        assert r.status_code == 404
