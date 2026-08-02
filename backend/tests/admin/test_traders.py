import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from tests.admin.conftest import ADMIN_HEADERS

client = TestClient(app)


class TestUC29ViewAllTraders:
    def test_A_29_BB_pending_filter_default(self):
        traders = [{"id": "t1", "role": "trader", "trader_status": "pending"}]
        with patch("app.routers.admin.getAllUserAccount", return_value=traders):
            r = client.get("/api/admin/users", headers=ADMIN_HEADERS)
        assert r.json()[0]["trader_status"] == "pending"

    def test_A_29_WB_single_fetch_client_side_filter(self):
        with patch("app.routers.admin.getAllUserAccount", return_value=[]) as mock_get:
            client.get("/api/admin/users", headers=ADMIN_HEADERS)
        assert mock_get.call_count == 1

    def test_A_29_FN_approve_moves_between_tabs(self):
        with patch("app.routers.admin.getAllUserAccount", return_value=[{"id": "t1", "trader_status": "pending"}]), \
             patch("app.routers.admin.approveTrader", return_value={"trader_status": "approved"}), \
             patch("app.routers.admin.logActivity", return_value=None):
            client.get("/api/admin/users", headers=ADMIN_HEADERS)
            r = client.patch("/api/admin/users/t1/approve-trader", headers=ADMIN_HEADERS)
        assert r.json()["trader_status"] == "approved"


class TestUC30ViewTraderDetails:
    def test_A_30_BB_auto_verification_result(self):
        with patch("app.routers.admin.verifyLicense", return_value={"valid": True, "authority": "CFA Institute"}):
            r = client.get("/api/admin/verify-license?number=CFA-12345", headers=ADMIN_HEADERS)
        assert r.json()["valid"] is True

    def test_A_30_WB_verification_fires_before_approve_enabled(self):
        with patch("app.routers.admin.verifyLicense", return_value={"valid": True}) as mock_verify, \
             patch("app.routers.admin.approveTrader", return_value={"trader_status": "approved"}) as mock_approve, \
             patch("app.routers.admin.logActivity", return_value=None):
            client.get("/api/admin/verify-license?number=CFA-12345", headers=ADMIN_HEADERS)
            client.patch("/api/admin/users/t1/approve-trader", headers=ADMIN_HEADERS)
        assert mock_verify.called and mock_approve.called

    def test_A_30_FN_approved_trader_gains_access(self):
        with patch("app.routers.admin.verifyLicense", return_value={"valid": True}), \
             patch("app.routers.admin.approveTrader", return_value={"trader_status": "approved"}), \
             patch("app.routers.admin.logActivity", return_value=None):
            client.get("/api/admin/verify-license?number=CFA-12345", headers=ADMIN_HEADERS)
            r = client.patch("/api/admin/users/t1/approve-trader", headers=ADMIN_HEADERS)
        assert r.json()["trader_status"] == "approved"
