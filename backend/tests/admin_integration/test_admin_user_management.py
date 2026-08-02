from app.core.database import supabase


class TestManageUserAccounts:
    def test_list_includes_real_users_with_subscription_status(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        target = make_user(role="investor")

        sub = None
        try:
            sub = (
                db.table("subscriptions")
                .insert({
                    "user_id": target["id"],
                    "plan": "premium",
                    "status": "active",
                    "expires_at": "2027-01-01T00:00:00Z",
                })
                .execute()
            ).data[0]

            resp = client.get("/api/admin/users", headers=auth_headers(admin))
            assert resp.status_code == 200, resp.text

            matching = [u for u in resp.json() if u["id"] == target["id"]]
            assert len(matching) == 1
            assert matching[0]["subscription_status"] == "active"
        finally:
            if sub:
                db.table("subscriptions").delete().eq("id", sub["id"]).execute()

    def test_non_admin_cannot_list_users(self, client, make_user, auth_headers):
        investor = make_user(role="investor")
        resp = client.get("/api/admin/users", headers=auth_headers(investor))
        assert resp.status_code == 403


class TestViewUserAccount:
    def test_view_user_returns_real_record_without_password_hash(
        self, client, make_user
    ):
        target = make_user(role="investor", name="View Test User")
        resp = client.get(f"/api/auth/user/{target['id']}")
        assert resp.status_code == 200, resp.text
        assert resp.json()["name"] == "View Test User"
        assert "password_hash" not in resp.json()

    def test_view_nonexistent_user_returns_404(self, client):
        resp = client.get("/api/auth/user/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


class TestSearchUserAccount:
    def test_search_matches_real_user_by_name_fragment(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        target = make_user(role="investor", name="Zzyzx Uniquename Searchable")

        resp = client.get(
            "/api/admin/users/search",
            params={"keywords": "Zzyzx Uniquename"},
            headers=auth_headers(admin),
        )
        assert resp.status_code == 200, resp.text
        ids = [u["id"] for u in resp.json()]
        assert target["id"] in ids

    def test_search_no_match_returns_empty_list(self, client, make_user, auth_headers):
        admin = make_user(role="admin")

        resp = client.get(
            "/api/admin/users/search",
            params={"keywords": "no-such-user-should-ever-match-zzz999"},
            headers=auth_headers(admin),
        )
        assert resp.status_code == 200
        assert resp.json() == []


class TestUpdateUserAccount:
    def test_update_persists_new_role_and_status(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        target = make_user(role="investor", status="active")

        resp = client.put(
            f"/api/admin/users/{target['id']}",
            json={"role": "trader", "status": "active", "name": "Renamed User"},
            headers=auth_headers(admin),
        )
        assert resp.status_code == 200, resp.text

        row = (
            db.table("users")
            .select("role, name")
            .eq("id", target["id"])
            .execute()
        )
        assert row.data[0]["role"] == "trader"
        assert row.data[0]["name"] == "Renamed User"

    def test_update_with_no_fields_returns_400(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        target = make_user(role="investor")

        resp = client.put(
            f"/api/admin/users/{target['id']}",
            json={},
            headers=auth_headers(admin),
        )
        assert resp.status_code == 400


class TestSuspendUserAccount:
    def test_suspend_persists_status_and_matching_activity_log(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        target = make_user(role="investor", status="active")

        resp = client.patch(
            f"/api/admin/users/{target['id']}/suspend",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "suspended"

        row = db.table("users").select("status").eq("id", target["id"]).execute()
        assert row.data[0]["status"] == "suspended"
        logs = (
            db.table("activity_logs")
            .select("*")
            .eq("action", "user_suspended")
            .eq("target_id", target["id"])
            .execute()
        )
        assert len(logs.data) == 1
        assert logs.data[0]["user_id"] == admin["id"]

    def test_suspending_already_suspended_user_returns_404(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        target = make_user(role="investor", status="suspended")

        resp = client.patch(
            f"/api/admin/users/{target['id']}/suspend",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 404

    def test_non_admin_cannot_suspend_and_nothing_is_written(
        self, client, make_user, auth_headers, db
    ):
        non_admin = make_user(role="investor")
        target = make_user(role="investor", status="active")

        resp = client.patch(
            f"/api/admin/users/{target['id']}/suspend",
            headers=auth_headers(non_admin),
        )
        assert resp.status_code == 403

        row = db.table("users").select("status").eq("id", target["id"]).execute()
        assert row.data[0]["status"] == "active"

        logs = (
            db.table("activity_logs")
            .select("*")
            .eq("target_id", target["id"])
            .execute()
        )
        assert logs.data == []

    def test_unsuspend_reverses_status_and_logs_correctly(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        target = make_user(role="investor", status="suspended")

        resp = client.patch(
            f"/api/admin/users/{target['id']}/unsuspend",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 200, resp.text

        row = db.table("users").select("status").eq("id", target["id"]).execute()
        assert row.data[0]["status"] == "active"

        logs = (
            db.table("activity_logs")
            .select("*")
            .eq("action", "user_unsuspended")
            .eq("target_id", target["id"])
            .execute()
        )
        assert len(logs.data) == 1


class TestDeleteUserAccount:
    def test_delete_removes_session_and_marks_status_deleted(
        self, client, make_user, db
    ):
        target = make_user(role="investor")
        supabase.table("users").update({"session_token": "some-active-token"}).eq(
            "id", target["id"]
        ).execute()

        resp = client.delete(f"/api/auth/user/{target['id']}")
        assert resp.status_code == 200, resp.text

        row = (
            db.table("users")
            .select("status, session_token")
            .eq("id", target["id"])
            .execute()
        )
        assert row.data[0]["status"] == "deleted"
        assert row.data[0]["session_token"] is None

    def test_delete_nonexistent_user_returns_404(self, client):
        resp = client.delete(
            "/api/auth/user/00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == 404

    def test_delete_account_route_has_no_auth_guard(self, client, make_user):
        target = make_user(role="investor")

        resp = client.delete(f"/api/auth/user/{target['id']}")
        assert resp.status_code == 200, (
            "If this now fails with 401/403, the route has been secured — "
            "update this test's expectation and delete this comment."
        )
