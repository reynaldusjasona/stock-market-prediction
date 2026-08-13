from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestPortfolio:
    def test_get_portfolio_success(self):
        mock_portfolio = [
            {"id": "p1", "ticker": "AAPL", "shares": 10, "average_buy_price": 150.0}
        ]
        with patch(
            "app.services.portfolio_service.getPortfolio", return_value=mock_portfolio
        ):
            r = client.get("/api/portfolio")
        assert r.status_code == 200
        assert r.json()[0]["ticker"] == "AAPL"

    def test_get_holding_detail_success(self):
        mock_holding = {"id": "p1", "ticker": "AAPL", "shares": 10, "average_buy_price": 150.0}
        with patch(
            "app.services.portfolio_service.getHoldingDetail",
            return_value=mock_holding,
        ):
            r = client.get("/api/portfolio/AAPL")
        assert r.status_code == 200
        assert r.json()["ticker"] == "AAPL"

    def test_get_holding_detail_not_found_returns_404(self):
        with patch(
            "app.services.portfolio_service.getHoldingDetail",
            side_effect=LookupError("Holding not found"),
        ):
            r = client.get("/api/portfolio/AAPL")
        assert r.status_code == 404

    def test_add_holding_success(self):
        with patch(
            "app.services.portfolio_service.addHolding",
            return_value={"id": "p1", "ticker": "AAPL", "shares": 10, "average_buy_price": 150.0},
        ):
            r = client.post(
                "/api/portfolio",
                json={"ticker": "AAPL", "shares": 10, "average_buy_price": 150.0},
            )
        assert r.status_code == 201

    def test_add_holding_invalid_values_returns_400(self):
        with patch(
            "app.services.portfolio_service.addHolding",
            side_effect=ValueError(
                "shares and average_buy_price must be greater than 0"
            ),
        ):
            r = client.post(
                "/api/portfolio",
                json={"ticker": "AAPL", "shares": -5, "average_buy_price": 150.0},
            )
        assert r.status_code == 400

    def test_remove_holding_success(self):
        with patch(
            "app.services.portfolio_service.removeHolding", return_value=True
        ):
            r = client.delete("/api/portfolio/AAPL")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_remove_holding_not_found_returns_404(self):
        with patch(
            "app.services.portfolio_service.removeHolding", return_value=False
        ):
            r = client.delete("/api/portfolio/AAPL")
        assert r.status_code == 404
