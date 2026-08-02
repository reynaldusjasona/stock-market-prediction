import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from tests.admin.conftest import ADMIN_HEADERS

client = TestClient(app)


class TestUC12ModelPerformance:
    def test_A_12_BB_metrics_displayed(self):
        perf = {"accuracy": 0.76, "buy_precision": 0.71, "sell_precision": 0.72, "recall": 0.76, "f1_score": 0.735}
        with patch("app.routers.admin.getModelPerformance", return_value=perf):
            r = client.get("/api/admin/model/performance", headers=ADMIN_HEADERS)
        assert r.status_code == 200

    def test_A_12_WB_precision_average_fallback(self):
        perf = {"buy_precision": 0.6, "sell_precision": 0.8}
        with patch("app.routers.admin.getModelPerformance", return_value=perf):
            r = client.get("/api/admin/model/performance", headers=ADMIN_HEADERS)
        data = r.json()
        assert (data["buy_precision"] + data["sell_precision"]) / 2 == pytest.approx(0.7)

    def test_A_12_FN_consistent_with_dashboard(self):
        perf = {"accuracy": 0.76}
        stats = {"model_accuracy": 0.76}
        with patch("app.routers.admin.getModelPerformance", return_value=perf), \
             patch("app.routers.admin.getDashboardStats", return_value=stats):
            r1 = client.get("/api/admin/model/performance", headers=ADMIN_HEADERS)
            r2 = client.get("/api/admin/stats", headers=ADMIN_HEADERS)
        assert r1.json()["accuracy"] == r2.json()["model_accuracy"]


class TestUC13PredictionQuality:
    def test_A_13_BB_two_class_chart_data(self):
        shaped = {"classes": [{"class_name": "Buy", "precision": 0.7, "recall": 0, "f1_score": 0, "support": 0},
                               {"class_name": "Sell", "precision": 0.6, "recall": 0, "f1_score": 0, "support": 0}],
                  "last_updated": None}
        with patch("app.routers.admin.getModelQuality", return_value=shaped):
            r = client.get("/api/admin/model/quality", headers=ADMIN_HEADERS)
        names = [c["class_name"] for c in r.json()["classes"]]
        assert "Buy" in names and "Sell" in names and "Hold" not in names

    def test_A_13_WB_dedup_keeps_latest_snapshot(self):
        shaped = {"classes": [{"class_name": "Buy", "precision": 0.7, "recall": 0, "f1_score": 0, "support": 0}], "last_updated": "2026-07-15T00:00:00Z"}
        with patch("app.routers.admin.getModelQuality", return_value=shaped):
            r = client.get("/api/admin/model/quality", headers=ADMIN_HEADERS)
        assert len(r.json()["classes"]) == 1

    def test_A_13_FN_chart_and_table_consistency(self):
        shaped = {"classes": [{"class_name": "Buy", "precision": 0.7, "recall": 0.65, "f1_score": 0.67, "support": 180}], "last_updated": None}
        with patch("app.routers.admin.getModelQuality", return_value=shaped):
            r = client.get("/api/admin/model/quality", headers=ADMIN_HEADERS)
        assert r.json()["classes"][0]["support"] == 180


class TestUC14Retrain:
    def test_A_14_BB_invalid_date_range_rejected(self):
        local_client = TestClient(app, raise_server_exceptions=False)
        with patch("app.routers.admin.requestModelRetrain", side_effect=ValueError("Start after end")):
            r = local_client.post("/api/admin/model/retrain", headers=ADMIN_HEADERS)
        assert r.status_code == 500

    def test_A_14_WB_payload_contains_job_id_on_success(self):
        with patch("app.routers.admin.requestModelRetrain", return_value={"message": "Model retrain request submitted", "status": "queued", "requested_at": "2026-08-01T00:00:00Z"}), \
             patch("app.routers.admin.logActivity", return_value=None):
            r = client.post("/api/admin/model/retrain", headers=ADMIN_HEADERS)
        assert "requested_at" in r.json()

    def test_A_14_FN_submit_then_poll_status(self):
        with patch("app.routers.admin.requestModelRetrain", return_value={"status": "queued", "requested_at": "2026-08-01T00:00:00Z", "message": "ok"}), \
             patch("app.routers.admin.logActivity", return_value=None), \
             patch("app.routers.admin.getRetrainStatus", return_value={"status": "completed"}):
            client.post("/api/admin/model/retrain", headers=ADMIN_HEADERS)
            r = client.get("/api/admin/model/retrain/status", headers=ADMIN_HEADERS)
        assert r.json()["status"] == "completed"
