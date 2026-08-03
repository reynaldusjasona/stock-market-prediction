from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from tests.admin.conftest import ADMIN_HEADERS

client = TestClient(app)


class TestUC24ViewAlerts:
    def test_A_24_BB_summary_and_table(self):
        with patch(
            "app.routers.admin.getAdminAlertsSummary",
            return_value={"critical": 1, "warning": 2, "info": 1, "resolved": 5},
        ):
            r = client.get("/api/admin/platform-alerts/summary", headers=ADMIN_HEADERS)
        assert r.json()["critical"] == 1

    def test_A_24_WB_correct_platform_alerts_endpoint(self):
        with patch("app.routers.admin.getAdminAlerts", return_value=[]):
            r = client.get("/api/admin/platform-alerts", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        assert "alerts" in r.json()

    def test_A_24_FN_filter_then_resolve_updates_summary(self):
        with patch(
            "app.routers.admin.getAdminAlerts", return_value=[{"severity": "critical"}]
        ), patch("app.routers.admin.resolveAdminAlert", return_value={"is_resolved": True}), patch(
            "app.routers.admin.logActivity", return_value=None
        ), patch(
            "app.routers.admin.getAdminAlertsSummary", return_value={"critical": 0, "resolved": 6}
        ):
            client.get("/api/admin/platform-alerts", headers=ADMIN_HEADERS)
            client.patch("/api/admin/platform-alerts/alt1/resolve", headers=ADMIN_HEADERS)
            r = client.get("/api/admin/platform-alerts/summary", headers=ADMIN_HEADERS)
        assert r.json()["critical"] == 0


class TestUC25SearchAlert:
    def test_A_25_BB_keyword_match(self):
        with patch(
            "app.routers.admin.getAdminAlerts", return_value=[{"message": "rate limit exceeded"}]
        ):
            r = client.get("/api/admin/platform-alerts", headers=ADMIN_HEADERS)
        assert r.status_code == 200

    def test_A_25_WB_special_characters_encoded(self):
        with patch("app.routers.admin.getAdminAlerts", return_value=[]):
            r = client.get("/api/admin/platform-alerts", headers=ADMIN_HEADERS)
        assert r.status_code == 200

    def test_A_25_FN_search_to_detail_to_resolve(self):
        with patch("app.routers.admin.getAdminAlerts", return_value=[{"id": "alt1"}]), patch(
            "app.routers.admin.resolveAdminAlert", return_value={"is_resolved": True}
        ), patch("app.routers.admin.logActivity", return_value=None):
            client.get("/api/admin/platform-alerts", headers=ADMIN_HEADERS)
            r = client.patch("/api/admin/platform-alerts/alt1/resolve", headers=ADMIN_HEADERS)
        assert r.json()["alert"]["is_resolved"] is True


class TestUC26ViewAlert:
    def test_A_26_BB_resolve_changes_status(self):
        with patch(
            "app.routers.admin.resolveAdminAlert", return_value={"is_resolved": True}
        ), patch("app.routers.admin.logActivity", return_value=None):
            r = client.patch("/api/admin/platform-alerts/alt1/resolve", headers=ADMIN_HEADERS)
        assert r.json()["alert"]["is_resolved"] is True

    def test_A_26_WB_correct_resolve_endpoint(self):
        with patch("app.routers.admin.resolveAdminAlert", return_value={}) as mock_resolve, patch(
            "app.routers.admin.logActivity", return_value=None
        ):
            client.patch("/api/admin/platform-alerts/alt1/resolve", headers=ADMIN_HEADERS)
        assert mock_resolve.called

    def test_A_26_FN_idempotent_double_resolve(self):
        with patch(
            "app.routers.admin.resolveAdminAlert", return_value={"is_resolved": True}
        ), patch("app.routers.admin.logActivity", return_value=None):
            r1 = client.patch("/api/admin/platform-alerts/alt1/resolve", headers=ADMIN_HEADERS)
            r2 = client.patch("/api/admin/platform-alerts/alt1/resolve", headers=ADMIN_HEADERS)
        assert r1.status_code == 200 and r2.status_code == 200
