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

    def test_create_feedback_non_investor_returns_403(self):
        app.dependency_overrides[get_current_user] = lambda: _MOCK_TRADER
        r = client.post(
            "/api/feedback",
            json={"subject": "Great app", "message": "Loving the predictions"},
        )
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
