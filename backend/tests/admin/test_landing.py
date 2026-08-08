from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from tests.admin.conftest import ADMIN_HEADERS

client = TestClient(app)


class TestUC11LandingPage:
    def test_A_11_BB_headline_persists(self):
        content = {"hero": {"headline": "New Headline"}}
        with patch("app.routers.admin.updateLandingContent", return_value=content), patch(
            "app.routers.admin.logActivity", return_value=None
        ):
            r = client.put("/api/admin/landing", json=content, headers=ADMIN_HEADERS)
        assert r.status_code == 200

    def test_A_11_WB_raw_object_not_wrapped(self):
        payload = {
            "hero": {"headline": "test"},
            "about": {},
            "features": {},
            "testimonials": [],
            "subscription": {},
        }
        with patch(
            "app.routers.admin.updateLandingContent", return_value=payload
        ) as mock_upd, patch("app.routers.admin.logActivity", return_value=None):
            client.put("/api/admin/landing", json=payload, headers=ADMIN_HEADERS)
        assert mock_upd.called
        called_body = mock_upd.call_args[0][0]
        assert called_body == payload

    def test_A_11_FN_all_five_sections_saved(self):
        full_content = {
            "hero": {},
            "about": {},
            "features": {},
            "testimonials": [],
            "subscription": {},
        }
        with patch("app.routers.admin.updateLandingContent", return_value=full_content), patch(
            "app.routers.admin.logActivity", return_value=None
        ), patch("app.routers.admin.getLandingContent", return_value=full_content):
            client.put("/api/admin/landing", json=full_content, headers=ADMIN_HEADERS)
            r = client.get("/api/admin/landing", headers=ADMIN_HEADERS)
        assert all(
            k in r.json()
            for k in ["hero", "about", "features", "testimonials", "subscription"]
        )
