from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestAccount:
    def test_get_account_details_success(self):
        mock_user = {
            "id": "investor1",
            "name": "Jamie Osei",
            "email": "jamie.osei@gmail.com",
            "role": "investor",
        }
        with patch(
            "app.routers.auth.svcGetUserDetails", return_value=mock_user
        ):
            r = client.get("/api/auth/user/investor1")
        assert r.status_code == 200
        assert r.json()["id"] == "investor1"

    def test_update_account_success(self):
        with patch(
            "app.routers.auth.validateFormInput", return_value={"valid": True}
        ), patch(
            "app.routers.auth.svcUpdateAccount",
            return_value={"id": "investor1", "name": "New Name"},
        ):
            r = client.put(
                "/api/auth/user/investor1",
                json={"name": "New Name"},
            )
        assert r.status_code == 200

    def test_update_account_invalid_password_returns_400(self):
        with patch(
            "app.routers.auth.validateFormInput",
            return_value={
                "valid": False,
                "error": "Password must be at least 8 characters",
            },
        ):
            r = client.put(
                "/api/auth/user/investor1",
                json={"password": "short"},
            )
        assert r.status_code == 400

    def test_update_account_other_user_returns_403(self):
        r = client.put(
            "/api/auth/user/someone-else-id",
            json={"name": "New Name"},
        )
        assert r.status_code == 403
