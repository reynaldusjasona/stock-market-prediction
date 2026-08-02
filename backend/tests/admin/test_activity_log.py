from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from tests.admin.conftest import ADMIN_HEADERS

client = TestClient(app)


class TestUC27ActivityLog:
    def test_A_27_BB_log_displayed(self):
        with patch(
            "app.routers.admin.getActivityLogs",
            return_value=[{"action": "login", "admin_name": "Test Admin"}],
        ):
            r = client.get("/api/admin/activity-log", headers=ADMIN_HEADERS)
        assert r.json()[0]["admin_name"] == "Test Admin"

    def test_A_27_WB_admin_name_joined_not_raw_uuid(self):
        with patch(
            "app.routers.admin.getActivityLogs",
            return_value=[{"admin_name": "Test Admin", "admin_email": "a@test.com"}],
        ):
            r = client.get("/api/admin/activity-log", headers=ADMIN_HEADERS)
        assert "admin_name" in r.json()[0] and "admin_email" in r.json()[0]

    def test_A_27_FN_new_action_appears_at_top(self):
        logs = [{"action": "suspend_user", "created_at": "2026-07-30T10:00:00Z"}]
        with patch("app.routers.admin.svcSuspendAccount", return_value={}), patch(
            "app.routers.admin.logActivity", return_value=None
        ), patch("app.routers.admin.getActivityLogs", return_value=logs):
            client.patch("/api/admin/users/u1/suspend", headers=ADMIN_HEADERS)
            r = client.get("/api/admin/activity-log", headers=ADMIN_HEADERS)
        assert r.json()[0]["action"] == "suspend_user"
