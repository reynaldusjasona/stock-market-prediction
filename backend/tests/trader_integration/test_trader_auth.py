"""
Integration tests for Trader auth (T-1 to T-4).
Run against a real Supabase test database.
"""

from app.core.security import decodeAccessToken


class TestTraderRegistration:
    """T-1-INT: End-to-end registration inserts user with pending status."""

    def test_trader_register_creates_pending_user(self, client, db):
        resp = client.post(
            "/api/auth/register",
            json={
                "name": "INT Trader",
                "email": "int_trader_reg@integration-test.local",
                "password": "Testing123!",
                "role": "trader",
                "license_number": "INT-LIC-001",
                "phone": "+6500000001",
                "specialization": "Equities",
                "years_experience": 3,
            },
        )
        assert resp.status_code == 200, resp.text
        user_id = resp.json()["user_id"]

        row = (
            db.table("users")
            .select("role, trader_status, license_number")
            .eq("id", user_id)
            .execute()
        )
        assert row.data[0]["role"] == "trader"
        assert row.data[0]["trader_status"] == "pending"
        assert row.data[0]["license_number"] == "INT-LIC-001"

        # cleanup
        db.table("users").delete().eq("id", user_id).execute()

    def test_trader_register_without_license_rejected(self, client):
        resp = client.post(
            "/api/auth/register",
            json={
                "name": "No License",
                "email": "nolic@integration-test.local",
                "password": "Testing123!",
                "role": "trader",
            },
        )
        assert resp.status_code == 400
        assert "license number" in resp.json()["detail"].lower()


class TestTraderLogin:
    """T-2-INT: Approved trader can log in; pending trader can log in
    but cannot access /trader/* endpoints."""

    def test_approved_trader_login_and_access(
        self, client, make_user, auth_headers
    ):
        trader = make_user(trader_status="approved")

        login = client.post(
            "/api/auth/login",
            json={"email": trader["email"], "password": "testing123"},
        )
        assert login.status_code == 200, login.text
        body = login.json()
        assert body["user"]["role"] == "trader"

        payload = decodeAccessToken(body["token"])
        assert payload["sub"] == trader["id"]
        assert payload["role"] == "trader"

        signals = client.get(
            "/api/trader/signals",
            headers={"Authorization": f"Bearer {body['token']}"},
        )
        assert signals.status_code == 200

    def test_pending_trader_blocked_from_trader_routes(
        self, client, make_user
    ):
        """Pending trader is blocked at login — auth_service.login()
        returns 403 before a token is ever issued."""
        trader = make_user(trader_status="pending")

        login = client.post(
            "/api/auth/login",
            json={"email": trader["email"], "password": "testing123"},
        )
        assert login.status_code == 403
        assert "pending" in login.json()["detail"].lower()


class TestTraderLogout:
    """T-3-INT: Logout clears session token in database."""

    def test_logout_clears_session_token(self, client, make_user, db):
        trader = make_user()

        login = client.post(
            "/api/auth/login",
            json={"email": trader["email"], "password": "testing123"},
        )
        assert login.status_code == 200
        token = login.json()["token"]

        row = (
            db.table("users")
            .select("session_token")
            .eq("id", trader["id"])
            .execute()
        )
        assert row.data[0]["session_token"] == token

        logout = client.post(
            "/api/auth/logout", json={"session_token": token}
        )
        assert logout.status_code == 200

        row = (
            db.table("users")
            .select("session_token")
            .eq("id", trader["id"])
            .execute()
        )
        assert row.data[0]["session_token"] is None


class TestTraderResetPassword:
    """T-14-INT: Trader can reset password; old password stops working."""

    def test_reset_password_works(self, client, make_user, auth_headers):
        trader = make_user()
        headers = auth_headers(trader)

        resp = client.post(
            "/api/auth/reset-password",
            json={"old_password": "testing123", "new_password": "newpass456"},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text

        old_login = client.post(
            "/api/auth/login",
            json={"email": trader["email"], "password": "testing123"},
        )
        assert old_login.status_code == 401

        new_login = client.post(
            "/api/auth/login",
            json={"email": trader["email"], "password": "newpass456"},
        )
        assert new_login.status_code == 200
