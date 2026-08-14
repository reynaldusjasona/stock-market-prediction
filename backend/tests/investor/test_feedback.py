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

_MOCK_ADMIN = {
    "id": "admin1",
    "sub": "admin1",
    "email": "admin@test.com",
    "role": "admin",
}


class TestFeedback:
    def test_create_feedback_success(self):
        with patch(
            "app.services.feedback_service.createFeedback",
            return_value={
                "id": "f1",
                "subject": "Great app",
                "message": "Loving the predictions",
                "rating": 5,
            },
        ):
            r = client.post(
                "/api/feedback",
                json={
                    "subject": "Great app",
                    "message": "Loving the predictions",
                    "rating": 5,
                },
            )
        assert r.status_code == 201

    def test_create_feedback_as_trader_success(self):
        app.dependency_overrides[get_current_user] = lambda: _MOCK_TRADER
        with patch(
            "app.services.feedback_service.createFeedback",
            return_value={
                "id": "f2",
                "subject": "Great app",
                "message": "Loving the predictions",
                "rating": 4,
            },
        ):
            r = client.post(
                "/api/feedback",
                json={
                    "subject": "Great app",
                    "message": "Loving the predictions",
                    "rating": 4,
                },
            )
        app.dependency_overrides.clear()
        assert r.status_code == 201

    def test_create_feedback_admin_returns_403(self):
        app.dependency_overrides[get_current_user] = lambda: _MOCK_ADMIN
        r = client.post(
            "/api/feedback",
            json={"subject": "Great app", "message": "Loving the predictions"},
        )
        app.dependency_overrides.clear()
        assert r.status_code == 403

    def test_create_feedback_service_failure_returns_500(self):
        with patch(
            "app.services.feedback_service.createFeedback",
            side_effect=Exception("db exploded"),
        ):
            r = client.post(
                "/api/feedback",
                json={"subject": "Great app", "message": "Loving the predictions"},
            )
        assert r.status_code == 500
