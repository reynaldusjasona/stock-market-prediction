"""
Trader test cases T-12 and T-13:
  T-12  View Own Account
  T-13  Update Own Account
"""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from tests.trader.conftest import TRADER_HEADERS

client = TestClient(app)

TRADER_PROFILE = {
    "id": "trader1",
    "name": "Test Trader",
    "email": "trader@test.com",
    "role": "trader",
    "phone": "+6591234567",
    "specialization": "Equities",
    "years_experience": 5,
    "license_number": "CFA-12345",
    "bio": "Experienced equities analyst",
    "trader_status": "approved",
}


# ---------------------------------------------------------------------------
# T-12  View Own Account
# ---------------------------------------------------------------------------
class TestUC12ViewAccount:
    def test_T_12_BB_returns_user_details(self):
        with patch(
            "app.routers.auth.svcGetUserDetails",
            return_value=TRADER_PROFILE,
        ):
            r = client.get(
                "/api/auth/user/trader1", headers=TRADER_HEADERS
            )
        assert r.status_code == 200

    def test_T_12_WB_includes_trader_specific_fields(self):
        with patch(
            "app.routers.auth.svcGetUserDetails",
            return_value=TRADER_PROFILE,
        ):
            r = client.get(
                "/api/auth/user/trader1", headers=TRADER_HEADERS
            )
        data = r.json()
        assert data["license_number"] == "CFA-12345"
        assert data["specialization"] == "Equities"
        assert data["trader_status"] == "approved"

    def test_T_12_FN_full_profile_retrieval(self):
        with patch(
            "app.routers.auth.svcGetUserDetails",
            return_value=TRADER_PROFILE,
        ):
            r = client.get(
                "/api/auth/user/trader1", headers=TRADER_HEADERS
            )
        data = r.json()
        for field in (
            "name",
            "email",
            "phone",
            "specialization",
            "years_experience",
            "bio",
        ):
            assert field in data


# ---------------------------------------------------------------------------
# T-13  Update Own Account
# ---------------------------------------------------------------------------
class TestUC13UpdateAccount:
    def test_T_13_BB_update_name_success(self):
        with patch(
            "app.routers.auth.validateFormInput",
            return_value={"valid": True},
        ), patch(
            "app.routers.auth.svcUpdateAccount",
            return_value={"message": "Account updated"},
        ):
            r = client.put(
                "/api/auth/user/trader1",
                json={"name": "Updated Trader"},
                headers=TRADER_HEADERS,
            )
        assert r.status_code == 200

    def test_T_13_WB_payload_includes_trader_fields(self):
        with patch(
            "app.routers.auth.validateFormInput",
            return_value={"valid": True},
        ), patch(
            "app.routers.auth.svcUpdateAccount",
            return_value={"message": "ok"},
        ) as mock_update:
            client.put(
                "/api/auth/user/trader1",
                json={
                    "name": "Updated Trader",
                    "specialization": "Derivatives",
                    "years_experience": 8,
                    "bio": "Derivatives specialist",
                },
                headers=TRADER_HEADERS,
            )
        kwargs = mock_update.call_args[1]
        assert kwargs["specialization"] == "Derivatives"
        assert kwargs["years_experience"] == 8
        assert kwargs["bio"] == "Derivatives specialist"

    def test_T_13_FN_full_update_with_all_fields(self):
        with patch(
            "app.routers.auth.validateFormInput",
            return_value={"valid": True},
        ), patch(
            "app.routers.auth.svcUpdateAccount",
            return_value={"message": "Account updated"},
        ):
            r = client.put(
                "/api/auth/user/trader1",
                json={
                    "name": "Updated Trader",
                    "phone": "+6598765432",
                    "specialization": "Portfolio Management",
                    "years_experience": 10,
                    "bio": "Senior portfolio manager",
                },
                headers=TRADER_HEADERS,
            )
        assert r.status_code == 200
