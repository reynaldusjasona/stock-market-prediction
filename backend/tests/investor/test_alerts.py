from unittest.mock import patch
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError
from app.main import app

client = TestClient(app)


class TestAlerts:
    def test_get_all_alerts_success(self):
        mock_alerts = [
            {"id": "a1", "ticker": "AAPL", "target_price": 200.0, "condition": "above"}
        ]
        with patch(
            "app.services.alert_service.getAllAlertsForUser", return_value=mock_alerts
        ):
            r = client.get("/api/alerts")
        assert r.status_code == 200
        assert r.json()[0]["ticker"] == "AAPL"

    def test_get_alerts_for_ticker_success(self):
        mock_alerts = [
            {"id": "a1", "ticker": "AAPL", "target_price": 200.0, "condition": "above"}
        ]
        with patch(
            "app.services.alert_service.getAlertForm", return_value=mock_alerts
        ):
            r = client.get("/api/alerts/AAPL")
        assert r.status_code == 200
        assert r.json()[0]["ticker"] == "AAPL"

    def test_create_alert_success(self):
        with patch(
            "app.services.alert_service.validateAndSaveAlert",
            return_value={"id": "a1", "ticker": "AAPL", "target_price": 200.0, "condition": "above"},
        ):
            r = client.post(
                "/api/alerts/AAPL",
                json={"target_price": 200.0, "condition": "above"},
            )
        assert r.status_code == 201

    def test_create_alert_invalid_condition_returns_400(self):
        with patch(
            "app.services.alert_service.validateAndSaveAlert",
            side_effect=ValueError("condition must be 'above' or 'below'"),
        ):
            r = client.post(
                "/api/alerts/AAPL",
                json={"target_price": 200.0, "condition": "sideways"},
            )
        assert r.status_code == 400

    def test_create_alert_untracked_ticker_returns_400(self):
        fk_error = APIError({
            "code": "23503",
            "message": "insert or update on table \"price_alerts\" violates "
            "foreign key constraint",
        })
        with patch(
            "app.services.alert_service.validateAndSaveAlert",
            side_effect=fk_error,
        ):
            r = client.post(
                "/api/alerts/GE",
                json={"target_price": 200.0, "condition": "above"},
            )
        assert r.status_code == 400

    def test_edit_alert_success(self):
        with patch(
            "app.services.alert_service.updatePriceAlerts",
            return_value={"id": "a1", "target_price": 210.0, "condition": "below"},
        ):
            r = client.patch(
                "/api/alerts/a1",
                json={"new_price": 210.0, "alert_type": "below"},
            )
        assert r.status_code == 200

    def test_edit_alert_not_found_returns_404(self):
        with patch(
            "app.services.alert_service.updatePriceAlerts",
            side_effect=LookupError("Alert not found"),
        ):
            r = client.patch(
                "/api/alerts/nonexistent",
                json={"new_price": 210.0, "alert_type": "below"},
            )
        assert r.status_code == 404

    def test_edit_alert_invalid_type_returns_400(self):
        with patch(
            "app.services.alert_service.updatePriceAlerts",
            side_effect=ValueError("alertType must be 'above' or 'below'"),
        ):
            r = client.patch(
                "/api/alerts/a1",
                json={"new_price": 210.0, "alert_type": "sideways"},
            )
        assert r.status_code == 400

    def test_remove_alert_success(self):
        with patch(
            "app.services.alert_service.deletePriceAlert", return_value=True
        ):
            r = client.delete("/api/alerts/a1")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_remove_alert_not_found_returns_404(self):
        with patch(
            "app.services.alert_service.deletePriceAlert", return_value=False
        ):
            r = client.delete("/api/alerts/nonexistent")
        assert r.status_code == 404
