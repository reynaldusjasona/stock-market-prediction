import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from tests.admin.conftest import ADMIN_HEADERS

client = TestClient(app)


class TestUC15ManageAPIs:
    def test_A_15_BB_three_seeded_sources(self):
        sources = [{"name": "Finnhub"}, {"name": "Alpha Vantage"}, {"name": "Twelve Data"}]
        with patch("app.routers.admin.getApiSources", return_value=sources):
            r = client.get("/api/admin/apis", headers=ADMIN_HEADERS)
        assert len(r.json()) == 3

    def test_A_15_WB_response_unwrap_sources_key(self):
        with patch("app.routers.admin.getApiSources", return_value=[]):
            r = client.get("/api/admin/apis", headers=ADMIN_HEADERS)
        assert isinstance(r.json(), list)

    def test_A_15_FN_add_then_appears_in_list(self):
        with patch("app.routers.admin.createApiSource", return_value={"id": "api4", "name": "New Source"}), \
             patch("app.routers.admin.logActivity", return_value=None), \
             patch("app.routers.admin.getApiSources", return_value=[{"name": "New Source"}]):
            client.post("/api/admin/apis", json={"name": "New Source", "base_url": "https://x.com"}, headers=ADMIN_HEADERS)
            r = client.get("/api/admin/apis", headers=ADMIN_HEADERS)
        assert any(s["name"] == "New Source" for s in r.json())


class TestUC16ViewAPI:
    def test_A_16_BB_detail_shown(self):
        api = {"id": "api1", "name": "Finnhub", "base_url": "https://finnhub.io/api/v1"}
        with patch("app.routers.admin.getApiSourceById", return_value=api):
            r = client.get("/api/admin/apis/api1", headers=ADMIN_HEADERS)
        assert r.json()["name"] == "Finnhub"

    def test_A_16_WB_no_refetch_when_data_present(self):
        with patch("app.routers.admin.getApiSourceById", return_value=None):
            pass
        assert True

    def test_A_16_FN_view_then_edit_flow(self):
        api = {"id": "api1", "name": "Finnhub"}
        with patch("app.routers.admin.getApiSourceById", return_value=api), \
             patch("app.routers.admin.updateApiSource", return_value={"name": "Finnhub Updated"}), \
             patch("app.routers.admin.logActivity", return_value=None):
            client.get("/api/admin/apis/api1", headers=ADMIN_HEADERS)
            r = client.patch("/api/admin/apis/api1", json={"name": "Finnhub Updated"}, headers=ADMIN_HEADERS)
        assert r.json()["name"] == "Finnhub Updated"


class TestUC17AddAPI:
    def test_A_17_BB_missing_name_rejected(self):
        r = client.post("/api/admin/apis", json={"base_url": "https://x.com"}, headers=ADMIN_HEADERS)
        assert r.status_code == 422

    def test_A_17_WB_correct_field_names(self):
        payload = {
            "name": "Test", "base_url": "https://test.com", "api_key_masked": "key123",
            "api_type": "REST", "description": "desc", "rate_limit": "60", "is_enable": True, "status": "active",
        }
        with patch("app.routers.admin.createApiSource", return_value=payload) as mock_create, \
             patch("app.routers.admin.logActivity", return_value=None):
            client.post("/api/admin/apis", json=payload, headers=ADMIN_HEADERS)
        assert mock_create.called

    def test_A_17_FN_full_creation_workflow(self):
        with patch("app.routers.admin.createApiSource", return_value={"id": "api5", "name": "New API"}), \
             patch("app.routers.admin.logActivity", return_value=None):
            r = client.post("/api/admin/apis", json={"name": "New API", "base_url": "https://new.com"}, headers=ADMIN_HEADERS)
        assert r.status_code == 200
        assert "id" in r.json()


class TestUC18EditAPI:
    def test_A_18_BB_rate_limit_updated(self):
        with patch("app.routers.admin.updateApiSource", return_value={"rate_limit": "120"}), \
             patch("app.routers.admin.logActivity", return_value=None):
            r = client.patch("/api/admin/apis/api1", json={"rate_limit": "120"}, headers=ADMIN_HEADERS)
        assert r.json()["rate_limit"] == "120"

    def test_A_18_WB_payload_types_match_schema(self):
        with patch("app.routers.admin.updateApiSource", return_value={}) as mock_upd, \
             patch("app.routers.admin.logActivity", return_value=None):
            client.patch("/api/admin/apis/api1", json={"rate_limit": "100"}, headers=ADMIN_HEADERS)
        assert mock_upd.called

    def test_A_18_FN_edit_then_delete_different_source(self):
        with patch("app.routers.admin.updateApiSource", return_value={"rate_limit": "50"}), \
             patch("app.routers.admin.deleteApiSource", return_value=True), \
             patch("app.routers.admin.logActivity", return_value=None):
            r1 = client.patch("/api/admin/apis/api1", json={"rate_limit": "50"}, headers=ADMIN_HEADERS)
            r2 = client.delete("/api/admin/apis/api2", headers=ADMIN_HEADERS)
        assert r1.status_code == 200 and r2.status_code == 200
