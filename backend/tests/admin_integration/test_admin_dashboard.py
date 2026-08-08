class TestAdminDashboard:
    def test_dashboard_stats_reflect_real_user_count(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")

        before = client.get("/api/admin/stats", headers=auth_headers(admin))
        assert before.status_code == 200, before.text
        before_count = before.json()["total_users"]

        make_user(role="investor")
        make_user(role="trader")

        after = client.get("/api/admin/stats", headers=auth_headers(admin))
        assert after.status_code == 200, after.text
        after_count = after.json()["total_users"]

        assert after_count == before_count + 2, (

            f"expected total_users to grow by 2 with two real inserts, "
            f"went {before_count} -> {after_count}"
        )

    def test_dashboard_requires_admin_role(self, client, make_user, auth_headers):
        investor = make_user(role="investor")

        resp = client.get("/api/admin/stats", headers=auth_headers(investor))
        assert resp.status_code == 403

    def test_dashboard_model_accuracy_matches_latest_metrics_row(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        metric_row = None
        try:
            inserted = (
                db.table("prediction_metrics")
                .insert({
                    "model_version": "test-dashboard-check",
                    "accuracy": 0.8123,
                    "evaluated_at": "2026-08-01T00:00:00Z",
                })
                .execute()
            )
            metric_row = inserted.data[0]["id"] if inserted.data else None

            resp = client.get("/api/admin/stats", headers=auth_headers(admin))
            assert resp.status_code == 200, resp.text
            assert resp.json()["model_accuracy"] == 0.8123
        finally:
            if metric_row:
                db.table("prediction_metrics").delete().eq(
                    "id", metric_row
                ).execute()
