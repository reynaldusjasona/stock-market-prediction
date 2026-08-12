"""
Trader test cases T-1 through T-4 (and T-14):
  T-1  Trader Registration
  T-2  Trader Login
  T-3  Trader Logout
  T-4  Pending Trader Access Restriction
  T-14 Reset Password
"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.routers.trader import require_approved_trader
from tests.trader.conftest import (
    MOCK_TRADER,
    TRADER_HEADERS,
    FakeSupabaseResult,
    _mock_require_approved_trader,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# T-1  Trader Registration
# ---------------------------------------------------------------------------
class TestUC1TraderRegistration:
    def test_T_1_BB_missing_license_rejected(self):
        """Trader registration without license_number returns 400."""
        with patch(
            "app.routers.auth.validateInputs", return_value={"valid": True}
        ):
            r = client.post(
                "/api/auth/register",
                json={
                    "name": "New Trader",
                    "email": "newtrader@test.com",
                    "password": "Test1234!",
                    "role": "trader",
                },
            )
        assert r.status_code == 400
        assert "license number" in r.json()["detail"].lower()

    def test_T_1_WB_insert_sets_pending_status_and_license(self):
        """Insert payload contains trader_status='pending' and the licence."""
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table

        select_chain = MagicMock()
        select_chain.execute.return_value = FakeSupabaseResult(data=[])
        mock_table.select.return_value = select_chain
        select_chain.eq.return_value = select_chain

        insert_chain = MagicMock()
        insert_chain.execute.return_value = FakeSupabaseResult(
            data=[{"id": "new-id"}]
        )
        mock_table.insert.return_value = insert_chain

        with patch("app.routers.auth.supabase", mock_client), patch(
            "app.routers.auth.validateInputs", return_value={"valid": True}
        ), patch(
            "app.routers.auth.savePreferences", return_value=None
        ), patch(
            "app.routers.auth.createAndSendVerificationEmail",
            return_value=None,
        ):
            r = client.post(
                "/api/auth/register",
                json={
                    "name": "New Trader",
                    "email": "newtrader@test.com",
                    "password": "Test1234!",
                    "role": "trader",
                    "license_number": "CFA-12345",
                },
            )
        assert r.status_code == 200
        payload = mock_table.insert.call_args[0][0]
        assert payload["trader_status"] == "pending"
        assert payload["license_number"] == "CFA-12345"
        assert payload["role"] == "trader"

    def test_T_1_FN_full_registration_returns_user_id(self):
        """End-to-end registration with all trader fields returns user_id."""
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table

        select_chain = MagicMock()
        select_chain.execute.return_value = FakeSupabaseResult(data=[])
        mock_table.select.return_value = select_chain
        select_chain.eq.return_value = select_chain

        insert_chain = MagicMock()
        insert_chain.execute.return_value = FakeSupabaseResult(
            data=[{"id": "new-trader-id"}]
        )
        mock_table.insert.return_value = insert_chain

        with patch("app.routers.auth.supabase", mock_client), patch(
            "app.routers.auth.validateInputs", return_value={"valid": True}
        ), patch(
            "app.routers.auth.savePreferences", return_value=None
        ), patch(
            "app.routers.auth.createAndSendVerificationEmail",
            return_value=None,
        ):
            r = client.post(
                "/api/auth/register",
                json={
                    "name": "New Trader",
                    "email": "newtrader@test.com",
                    "password": "Test1234!",
                    "role": "trader",
                    "license_number": "CFA-12345",
                    "phone": "+6591234567",
                    "specialization": "Equities",
                    "years_experience": 5,
                },
            )
        assert r.status_code == 200
        assert r.json()["user_id"] == "new-trader-id"
        assert r.json()["message"] == "Registration successful"


# ---------------------------------------------------------------------------
# T-2  Trader Login
# ---------------------------------------------------------------------------
class TestUC2TraderLogin:
    def test_T_2_BB_wrong_password(self):
        local_client = TestClient(app, raise_server_exceptions=False)
        with patch(
            "app.routers.auth.svcLogin",
            side_effect=Exception("Invalid credentials"),
        ):
            r = local_client.post(
                "/api/auth/login",
                json={"email": "trader@test.com", "password": "wrong"},
            )
        assert r.status_code == 500

    def test_T_2_WB_response_contains_trader_role(self):
        mock_result = {
            "user": {
                "id": "t1",
                "email": "trader@test.com",
                "role": "trader",
                "trader_status": "approved",
            },
            "token": "tok",
        }
        with patch(
            "app.routers.auth.svcLogin", return_value=mock_result
        ), patch("app.routers.auth.logActivity", return_value=None):
            r = client.post(
                "/api/auth/login",
                json={"email": "trader@test.com", "password": "correct"},
            )
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "trader"

    def test_T_2_FN_full_login_returns_token(self):
        mock_result = {
            "user": {
                "id": "t1",
                "email": "trader@test.com",
                "role": "trader",
            },
            "token": "jwt-token-here",
        }
        with patch(
            "app.routers.auth.svcLogin", return_value=mock_result
        ), patch("app.routers.auth.logActivity", return_value=None):
            r = client.post(
                "/api/auth/login",
                json={"email": "trader@test.com", "password": "correct"},
            )
        assert r.status_code == 200 and "token" in r.json()


# ---------------------------------------------------------------------------
# T-3  Trader Logout
# ---------------------------------------------------------------------------
class TestUC3TraderLogout:
    def test_T_3_BB_logout_success(self):
        with patch("app.routers.auth.svcLogout", return_value=True):
            r = client.post(
                "/api/auth/logout", json={"session_token": "tok123"}
            )
        assert r.status_code == 200

    def test_T_3_WB_session_cleared(self):
        with patch(
            "app.routers.auth.svcLogout", return_value=True
        ) as mock_logout:
            client.post(
                "/api/auth/logout", json={"session_token": "tok123"}
            )
        mock_logout.assert_called_once_with("tok123")

    def test_T_3_FN_logout_returns_200(self):
        with patch("app.routers.auth.svcLogout", return_value=True):
            r = client.post(
                "/api/auth/logout", json={"session_token": "tok123"}
            )
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# T-4  Pending Trader Access Restriction
# ---------------------------------------------------------------------------
class TestUC4PendingAccess:
    def test_T_4_BB_pending_trader_blocked(self, mock_supabase):
        """Trader with status 'pending' gets 403 on /trader/* endpoints."""
        saved = app.dependency_overrides.pop(require_approved_trader, None)
        mock_supabase.set_result(data=[{"trader_status": "pending"}])
        try:
            r = client.get("/api/trader/signals", headers=TRADER_HEADERS)
            assert r.status_code == 403
            assert "pending" in r.json()["detail"].lower()
        finally:
            if saved:
                app.dependency_overrides[require_approved_trader] = saved

    def test_T_4_WB_non_trader_role_blocked(self, mock_supabase):
        """Non-trader role (e.g. investor) gets 403 'Trader access required'."""
        from app.core.security import get_current_user

        saved_guard = app.dependency_overrides.pop(
            require_approved_trader, None
        )
        investor = {**MOCK_TRADER, "role": "investor"}
        original_user_override = app.dependency_overrides.get(
            get_current_user
        )
        app.dependency_overrides[get_current_user] = lambda: investor
        try:
            r = client.get("/api/trader/signals", headers=TRADER_HEADERS)
            assert r.status_code == 403
            assert "trader access" in r.json()["detail"].lower()
        finally:
            if original_user_override:
                app.dependency_overrides[
                    get_current_user
                ] = original_user_override
            else:
                app.dependency_overrides[
                    get_current_user
                ] = lambda: MOCK_TRADER
            if saved_guard:
                app.dependency_overrides[
                    require_approved_trader
                ] = saved_guard

    def test_T_4_FN_approved_trader_passes_guard(self, mock_supabase):
        """Approved trader passes the guard and reaches the endpoint."""
        saved = app.dependency_overrides.pop(require_approved_trader, None)
        mock_supabase.set_result(data=[{"trader_status": "approved"}])
        try:
            with patch(
                "app.routers.trader.getTraderSignals", return_value=[]
            ):
                r = client.get(
                    "/api/trader/signals", headers=TRADER_HEADERS
                )
            assert r.status_code == 200
        finally:
            if saved:
                app.dependency_overrides[require_approved_trader] = saved


# ---------------------------------------------------------------------------
# T-14  Reset Password
# ---------------------------------------------------------------------------
class TestUC14ResetPassword:
    def test_T_14_BB_wrong_old_password(self):
        local_client = TestClient(app, raise_server_exceptions=False)
        with patch(
            "app.routers.auth.changePassword",
            side_effect=Exception("not found"),
        ):
            r = local_client.post(
                "/api/auth/reset-password",
                json={"old_password": "x", "new_password": "y"},
            )
        assert r.status_code == 500

    def test_T_14_WB_changePassword_called_correctly(self):
        with patch(
            "app.routers.auth.changePassword",
            return_value={"message": "ok"},
        ) as mock_change:
            client.post(
                "/api/auth/reset-password",
                json={"old_password": "old", "new_password": "new"},
            )
        assert mock_change.called
        args = mock_change.call_args[0]
        assert args[1] == "old" and args[2] == "new"

    def test_T_14_FN_password_reset_success(self):
        with patch(
            "app.routers.auth.changePassword",
            return_value={"message": "Password updated"},
        ):
            r = client.post(
                "/api/auth/reset-password",
                json={"old_password": "old", "new_password": "new"},
            )
        assert r.status_code == 200
