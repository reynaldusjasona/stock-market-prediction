from unittest.mock import patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestLogin:
    def test_login_success(self):
        mock_result = {
            "user": {"id": "i1", "email": "investor@test.com", "role": "investor"},
            "token": "tok",
        }
        with patch("app.routers.auth.svcLogin", return_value=mock_result), patch(
            "app.routers.auth.logActivity", return_value=None
        ):
            r = client.post(
                "/api/auth/login",
                json={"email": "investor@test.com", "password": "correct"},
            )
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "investor"

    def test_login_wrong_password(self):
        with patch(
            "app.routers.auth.svcLogin",
            side_effect=HTTPException(status_code=401, detail="Invalid credentials"),
        ):
            r = client.post(
                "/api/auth/login",
                json={"email": "investor@test.com", "password": "wrong"},
            )
        assert r.status_code == 401

    def test_login_unknown_email(self):
        with patch(
            "app.routers.auth.svcLogin",
            side_effect=HTTPException(status_code=401, detail="Invalid credentials"),
        ):
            r = client.post(
                "/api/auth/login",
                json={"email": "nobody@test.com", "password": "whatever"},
            )
        assert r.status_code == 401


class TestLogout:
    def test_logout_success(self):
        with patch("app.routers.auth.svcLogout", return_value=True):
            r = client.post("/api/auth/logout", json={"session_token": "tok123"})
        assert r.status_code == 200

    def test_logout_clears_session_token(self):
        with patch("app.routers.auth.svcLogout", return_value=True) as mock_logout:
            client.post("/api/auth/logout", json={"session_token": "tok123"})
        mock_logout.assert_called_once_with("tok123")


class TestResetPassword:
    def test_reset_password_success_with_correct_old_password(self):
        with patch(
            "app.routers.auth.changePassword",
            return_value={"message": "Password updated"},
        ):
            r = client.post(
                "/api/auth/reset-password",
                json={"old_password": "old", "new_password": "new"},
            )
        assert r.status_code == 200

    def test_reset_password_rejected_with_wrong_old_password(self):
        with patch(
            "app.routers.auth.changePassword",
            side_effect=HTTPException(
                status_code=400, detail="Current password is incorrect"
            ),
        ):
            r = client.post(
                "/api/auth/reset-password",
                json={"old_password": "wrong", "new_password": "new"},
            )
        assert r.status_code == 400
