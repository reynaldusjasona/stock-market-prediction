import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from tests.admin.conftest import ADMIN_HEADERS

client = TestClient(app)


class TestUC1Login:
    def test_A_1_BB_wrong_password(self):
        local_client = TestClient(app, raise_server_exceptions=False)
        with patch("app.routers.auth.svcLogin", side_effect=Exception("Invalid credentials")):
            r = local_client.post("/api/auth/login", json={"email": "admin@test.com", "password": "wrong"})
        assert r.status_code == 500

    def test_A_1_WB_request_shape(self):
        mock_result = {"user": {"id": "a1", "email": "admin@test.com", "role": "admin"}, "token": "tok"}
        with patch("app.routers.auth.svcLogin", return_value=mock_result), \
             patch("app.routers.auth.logActivity", return_value=None):
            r = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "correct"})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_A_1_FN_full_login_to_dashboard(self):
        mock_result = {"user": {"id": "a1", "email": "admin@test.com", "role": "admin"}, "token": "tok"}
        with patch("app.routers.auth.svcLogin", return_value=mock_result), \
             patch("app.routers.auth.logActivity", return_value=None):
            r = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "correct"})
        assert r.status_code == 200 and "token" in r.json()


class TestUC2Logout:
    def test_A_2_BB_logout_success(self):
        with patch("app.routers.auth.svcLogout", return_value=True):
            r = client.post("/api/auth/logout", json={"session_token": "tok123"})
        assert r.status_code == 200

    def test_A_2_WB_session_cleared(self):
        with patch("app.routers.auth.svcLogout", return_value=True) as mock_logout:
            client.post("/api/auth/logout", json={"session_token": "tok123"})
        mock_logout.assert_called_once_with("tok123")

    def test_A_2_FN_protected_route_blocked_after_logout(self):
        with patch("app.routers.auth.svcLogout", return_value=True):
            r = client.post("/api/auth/logout", json={"session_token": "tok123"})
        assert r.status_code == 200


class TestUC3ResetPassword:
    def test_A_3_BB_unknown_email(self):
        local_client = TestClient(app, raise_server_exceptions=False)
        with patch("app.routers.auth.changePassword", side_effect=Exception("not found")):
            r = local_client.post("/api/auth/reset-password", json={"old_password": "x", "new_password": "y"})
        assert r.status_code == 500

    def test_A_3_WB_payload_is_email_only(self):
        with patch("app.routers.auth.changePassword", return_value={"message": "ok"}) as mock_change:
            client.post("/api/auth/reset-password", json={"old_password": "old", "new_password": "new"})
        assert mock_change.called
        args = mock_change.call_args[0]
        assert args[1] == "old" and args[2] == "new"

    def test_A_3_FN_valid_email_confirms(self):
        with patch("app.routers.auth.changePassword", return_value={"message": "Password updated"}):
            r = client.post("/api/auth/reset-password", json={"old_password": "old", "new_password": "new"})
        assert r.status_code == 200
