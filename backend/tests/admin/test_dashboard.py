import pytest
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from tests.admin.conftest import ADMIN_HEADERS

client = TestClient(app)


class TestUC4Dashboard:
    def test_A_4_BB_stats_display(self):
        stats = {"total_users": 41, "model_accuracy": 0.76, "pending_feedback": 1, "total_alerts": 4}
        with patch("app.routers.admin.getDashboardStats", return_value=stats):
            r = client.get("/api/admin/stats", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        assert r.json()["total_users"] == 41

    def test_A_4_WB_model_accuracy_is_decimal_fraction(self):
        stats = {"model_accuracy": 0.7602}
        with patch("app.routers.admin.getDashboardStats", return_value=stats):
            r = client.get("/api/admin/stats", headers=ADMIN_HEADERS)
        assert 0 <= r.json()["model_accuracy"] <= 1

    def test_A_4_FN_attention_strip_data_available(self):
        stats = {"total_alerts": 4, "pending_feedback": 1}
        with patch("app.routers.admin.getDashboardStats", return_value=stats):
            r = client.get("/api/admin/stats", headers=ADMIN_HEADERS)
        assert r.json()["total_alerts"] > 0 and r.json()["pending_feedback"] > 0
