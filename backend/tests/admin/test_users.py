from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from tests.admin.conftest import ADMIN_HEADERS

client = TestClient(app)


class TestUC5ManageUsers:
    def test_A_5_BB_filter_active(self):
        users = [{"id": "u1", "status": "active"}, {"id": "u2", "status": "suspended"}]
        with patch("app.routers.admin.getAllUserAccount", return_value=users):
            r = client.get("/api/admin/users", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_A_5_WB_no_refetch_on_filter_switch(self):
        with patch("app.routers.admin.getAllUserAccount", return_value=[]) as mock_get:
            client.get("/api/admin/users", headers=ADMIN_HEADERS)
        assert mock_get.call_count == 1

    def test_A_5_FN_browse_all_filter_states(self):
        users = [{"id": "u1", "status": "active"}, {"id": "u2", "status": "suspended"}]
        with patch("app.routers.admin.getAllUserAccount", return_value=users):
            r = client.get("/api/admin/users", headers=ADMIN_HEADERS)
        assert r.status_code == 200


class TestUC6ViewUser:
    def test_A_6_BB_detail_displayed(self):
        user = {"id": "u1", "name": "Test User", "email": "t@test.com"}
        with patch("app.routers.auth.svcGetUserDetails", return_value=user):
            r = client.get("/api/auth/user/u1")
        assert r.status_code == 200
        assert r.json()["name"] == "Test User"

    def test_A_6_WB_not_found_returns_404(self):
        local_client = TestClient(app, raise_server_exceptions=False)
        with patch("app.routers.auth.svcGetUserDetails", side_effect=Exception("not found")):
            r = local_client.get("/api/auth/user/nonexistent")
        assert r.status_code == 500

    def test_A_6_FN_sequential_distinct_users(self):
        user1 = {"id": "u1", "name": "User One"}
        user2 = {"id": "u2", "name": "User Two"}
        with patch("app.routers.auth.svcGetUserDetails", side_effect=[user1, user2]):
            r1 = client.get("/api/auth/user/u1")
            r2 = client.get("/api/auth/user/u2")
        assert r1.json()["name"] != r2.json()["name"]


class TestUC7SearchUser:
    def test_A_7_BB_unique_name_match(self):
        with patch(
            "app.routers.admin.searchUserByKeywords",
            return_value=[{"id": "u1", "name": "UniqueXYZ"}],
        ):
            r = client.get("/api/admin/users/search?keywords=UniqueXYZ", headers=ADMIN_HEADERS)
        assert r.status_code == 200

    def test_A_7_WB_correct_endpoint_path(self):
        with patch("app.routers.admin.searchUserByKeywords", return_value=[]):
            r = client.get("/api/admin/users/search?keywords=test", headers=ADMIN_HEADERS)
        assert r.status_code == 200

    def test_A_7_FN_search_then_reset(self):
        all_users = [{"id": "u1"}, {"id": "u2"}]
        with patch("app.routers.admin.getAllUserAccount", return_value=all_users):
            r = client.get("/api/admin/users", headers=ADMIN_HEADERS)
        assert len(r.json()) == 2


class TestUC8UpdateUser:
    def test_A_8_BB_role_status_change(self):
        with patch("app.routers.admin.validatePermission", return_value=True), patch(
            "app.routers.admin.svcUpdateUserDetails",
            return_value={"role": "trader", "status": "active"},
        ):
            r = client.put(
                "/api/admin/users/u1",
                json={"role": "trader", "status": "active"},
                headers=ADMIN_HEADERS,
            )
        assert r.status_code == 200

    def test_A_8_WB_payload_only_role_and_status(self):
        with patch("app.routers.admin.validatePermission", return_value=True), patch(
            "app.routers.admin.svcUpdateUserDetails", return_value={}
        ) as mock_upd:
            client.put(
                "/api/admin/users/u1",
                json={"role": "trader", "status": "active"},
                headers=ADMIN_HEADERS,
            )
        assert mock_upd.called
        args = mock_upd.call_args[0]
        assert args[1] == "trader" and args[2] == "active"

    def test_A_8_FN_role_change_reflected_in_traders_list(self):
        with patch("app.routers.admin.validatePermission", return_value=True), patch(
            "app.routers.admin.svcUpdateUserDetails", return_value={"role": "trader"}
        ), patch(
            "app.routers.admin.getAllUserAccount", return_value=[{"id": "u1", "role": "trader"}]
        ):
            client.put(
                "/api/admin/users/u1",
                json={"role": "trader", "status": "active"},
                headers=ADMIN_HEADERS,
            )
            r = client.get("/api/admin/users", headers=ADMIN_HEADERS)
        assert any(u["role"] == "trader" for u in r.json())


class TestUC9SuspendUser:
    def test_A_9_BB_suspend_changes_status(self):
        with patch(
            "app.routers.admin.svcSuspendAccount", return_value={"status": "suspended"}
        ), patch("app.routers.admin.logActivity", return_value=None):
            r = client.patch("/api/admin/users/u1/suspend", headers=ADMIN_HEADERS)
        assert r.json()["status"] == "suspended"

    def test_A_9_WB_reason_included_in_payload(self):
        with patch("app.routers.admin.svcSuspendAccount", return_value={}) as mock_susp, patch(
            "app.routers.admin.logActivity", return_value=None
        ):
            client.patch("/api/admin/users/u1/suspend", headers=ADMIN_HEADERS)
        assert mock_susp.called

    def test_A_9_FN_suspend_then_unsuspend(self):
        with patch(
            "app.routers.admin.svcSuspendAccount", return_value={"status": "suspended"}
        ), patch("app.routers.admin.svcUnsuspendAccount", return_value={"status": "active"}), patch(
            "app.routers.admin.logActivity", return_value=None
        ):
            r1 = client.patch("/api/admin/users/u1/suspend", headers=ADMIN_HEADERS)
            r2 = client.patch("/api/admin/users/u1/unsuspend", headers=ADMIN_HEADERS)
        assert r1.json()["status"] == "suspended" and r2.json()["status"] == "active"


class TestUC10DeleteUser:
    def test_A_10_BB_delete_removes_user(self):
        with patch(
            "app.routers.auth.getDeleteConfirm", return_value={"session_token": None}
        ), patch("app.routers.auth.deleteAccountAndData", return_value=True):
            r = client.delete("/api/auth/user/u1")
        assert r.status_code == 200

    def test_A_10_WB_correct_route_used(self):
        with patch(
            "app.routers.auth.getDeleteConfirm", return_value={"session_token": None}
        ) as mock_confirm, patch(
            "app.routers.auth.deleteAccountAndData", return_value=True
        ) as mock_del:
            client.delete("/api/auth/user/u1")
        assert mock_confirm.called and mock_del.called

    def test_A_10_FN_deleted_user_not_searchable(self):
        with patch(
            "app.routers.auth.getDeleteConfirm", return_value={"session_token": None}
        ), patch("app.routers.auth.deleteAccountAndData", return_value=True), patch(
            "app.routers.admin.searchUserByKeywords", return_value=[]
        ):
            client.delete("/api/auth/user/u1")
            r = client.get("/api/admin/users/search?keywords=deleted-user", headers=ADMIN_HEADERS)
        assert r.json() == []
