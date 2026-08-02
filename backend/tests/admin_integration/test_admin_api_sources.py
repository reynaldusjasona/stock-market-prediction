class TestManageApiSources:
    def test_list_includes_a_newly_created_source(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        created_id = None
        try:
            create = client.post(
                "/api/admin/apis",
                json={
                    "name": "Integration Test Source",
                    "base_url": "https://example.test/api",
                    "rate_limit": "60/min",
                    "api_type": "REST",
                    "is_enable": True,
                    "status": "active",
                },
                headers=auth_headers(admin),
            )
            assert create.status_code == 200, create.text
            created_id = create.json()["id"]

            listing = client.get("/api/admin/apis", headers=auth_headers(admin))
            assert listing.status_code == 200, listing.text
            names = [s["name"] for s in listing.json()["sources"]]
            assert "Integration Test Source" in names
        finally:
            if created_id:
                db.table("api_sources").delete().eq("id", created_id).execute()

    def test_non_admin_cannot_list_api_sources(self, client, make_user, auth_headers):
        investor = make_user(role="investor")
        resp = client.get("/api/admin/apis", headers=auth_headers(investor))
        assert resp.status_code == 403


class TestViewApiSource:
    def test_view_returns_the_real_created_row(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        created_id = None
        try:
            create = client.post(
                "/api/admin/apis",
                json={"name": "Viewable Source", "is_enable": True, "status": "active"},
                headers=auth_headers(admin),
            )
            created_id = create.json()["id"]

            resp = client.get(
                f"/api/admin/apis/{created_id}", headers=auth_headers(admin)
            )
            assert resp.status_code == 200, resp.text
            assert resp.json()["name"] == "Viewable Source"
        finally:
            if created_id:
                db.table("api_sources").delete().eq("id", created_id).execute()

    def test_view_nonexistent_source_returns_404(self, client, make_user, auth_headers):
        admin = make_user(role="admin")
        resp = client.get(
            "/api/admin/apis/00000000-0000-0000-0000-000000000000",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 404


class TestAddApiSource:
    def test_created_source_persists_is_enabled_correctly(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        created_id = None
        try:
            resp = client.post(
                "/api/admin/apis",
                json={"name": "Enable Flag Source", "is_enable": False, "status": "active"},
                headers=auth_headers(admin),
            )
            assert resp.status_code == 200, resp.text
            created_id = resp.json()["id"]

            row = (
                db.table("api_sources")
                .select("is_enabled")
                .eq("id", created_id)
                .execute()
            )
            assert row.data[0]["is_enabled"] is False
        finally:
            if created_id:
                db.table("api_sources").delete().eq("id", created_id).execute()

    def test_create_without_name_returns_400(self, client, make_user, auth_headers):
        admin = make_user(role="admin")
        # FastAPI's own Pydantic validation rejects a missing required
        # field before the route body even runs.
        resp = client.post(
            "/api/admin/apis",
            json={"status": "active"},
            headers=auth_headers(admin),
        )
        assert resp.status_code == 422


class TestEditApiSource:
    def test_update_persists_new_rate_limit_and_logs_activity(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        created_id = None
        try:
            create = client.post(
                "/api/admin/apis",
                json={"name": "Editable Source", "rate_limit": "10/min", "status": "active"},
                headers=auth_headers(admin),
            )
            created_id = create.json()["id"]

            update = client.patch(
                f"/api/admin/apis/{created_id}",
                json={"rate_limit": "100/min"},
                headers=auth_headers(admin),
            )
            assert update.status_code == 200, update.text

            row = (
                db.table("api_sources")
                .select("rate_limit")
                .eq("id", created_id)
                .execute()
            )
            assert row.data[0]["rate_limit"] == "100/min"

            logs = (
                db.table("activity_logs")
                .select("*")
                .eq("action", "api_source_updated")
                .eq("target_id", created_id)
                .execute()
            )
            assert len(logs.data) == 1
        finally:
            if created_id:
                db.table("api_sources").delete().eq("id", created_id).execute()

    def test_edit_nonexistent_source_returns_404(self, client, make_user, auth_headers):
        admin = make_user(role="admin")
        resp = client.patch(
            "/api/admin/apis/00000000-0000-0000-0000-000000000000",
            json={"rate_limit": "5/min"},
            headers=auth_headers(admin),
        )
        assert resp.status_code == 404
