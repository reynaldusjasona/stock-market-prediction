from unittest.mock import patch
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


class TestSubscription:
    def test_get_subscription_success(self):
        mock_sub = {
            "id": "s1",
            "user_id": "investor1",
            "plan": "investor",
            "status": "active",
        }
        with patch(
            "app.services.subscription_service.getSubscription",
            return_value=mock_sub,
        ):
            r = client.get("/api/subscription")
        assert r.status_code == 200
        assert r.json()["plan"] == "investor"

    def test_subscribe_to_investor_plan_success(self):
        with patch(
            "app.services.subscription_service.createSubscription",
            return_value={"id": "s1", "plan": "investor", "status": "active"},
        ), patch("app.routers.subscription.logActivity", return_value=None):
            r = client.post("/api/subscription", json={"plan": "investor"})
        assert r.status_code == 201

    def test_subscribe_invalid_plan_returns_400(self):
        r = client.post("/api/subscription", json={"plan": "bogus_plan"})
        assert r.status_code == 400

    def test_subscribe_as_trader_returns_400(self):
        app.dependency_overrides[get_current_user] = lambda: _MOCK_TRADER
        r = client.post("/api/subscription", json={"plan": "investor"})
        assert r.status_code == 400

    def test_subscribe_already_subscribed_returns_409(self):
        with patch(
            "app.services.subscription_service.createSubscription",
            side_effect=ValueError("Already subscribed"),
        ), patch("app.routers.subscription.logActivity", return_value=None):
            r = client.post("/api/subscription", json={"plan": "investor"})
        assert r.status_code == 409

    def test_cancel_investor_plan_success(self):
        with patch(
            "app.services.subscription_service.cancelSubscription",
            return_value={"id": "s1", "status": "cancelled"},
        ):
            r = client.post("/api/subscription/cancel")
        assert r.status_code == 200

    def test_cancel_investor_plan_no_active_sub_returns_404(self):
        with patch(
            "app.services.subscription_service.cancelSubscription",
            side_effect=LookupError("No active subscription"),
        ):
            r = client.post("/api/subscription/cancel")
        assert r.status_code == 404

    def test_signal_access_checkout_success(self):
        with patch(
            "app.services.subscription_service.createSignalAccessCheckout",
            return_value={"checkout_url": "https://checkout.stripe.com/mock"},
        ):
            r = client.post("/api/subscription/signal-access/checkout")
        assert r.status_code == 200

    def test_signal_access_checkout_non_investor_returns_400(self):
        app.dependency_overrides[get_current_user] = lambda: _MOCK_TRADER
        r = client.post("/api/subscription/signal-access/checkout")
        assert r.status_code == 400

    def test_cancel_signal_access_success(self):
        with patch(
            "app.services.subscription_service.cancelSignalAccess",
            return_value={"id": "s1", "has_signal_access": False},
        ):
            r = client.post("/api/subscription/signal-access/cancel")
        assert r.status_code == 200

    def test_cancel_signal_access_not_active_returns_404(self):
        with patch(
            "app.services.subscription_service.cancelSignalAccess",
            side_effect=LookupError("Signal access is not active"),
        ):
            r = client.post("/api/subscription/signal-access/cancel")
        assert r.status_code == 404
