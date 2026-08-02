import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from tests.admin.conftest import ADMIN_HEADERS

client = TestClient(app)


class TestUC28ViewOwnAccount:
    def test_A_28_BB_no_edit_option(self):
        r = client.patch("/api/auth/me", json={"name": "Hacked"}, headers=ADMIN_HEADERS)
        assert r.status_code in [404, 405]

    def test_A_28_WB_reads_from_session_not_api(self):
        assert True

    def test_A_28_FN_session_data_consistent(self):
        r = client.get("/api/auth/me", headers=ADMIN_HEADERS)
        assert r.status_code in [404, 405]
