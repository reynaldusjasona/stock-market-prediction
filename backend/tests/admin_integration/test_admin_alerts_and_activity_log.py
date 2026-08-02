class TestViewAlerts:
    def test_platform_alerts_summary_reflects_real_rows(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        inserted_ids = []
        try:
            for row in (
                {"severity": "critical", "is_resolved": False, "message": "Test critical"},
                {"severity": "warning", "is_resolved": True, "message": "Test warning"},
            ):
                result = db.table("admin_alerts").insert(row).execute()
                if result.data:
                    inserted_ids.append(result.data[0]["id"])

            resp = client.get(
                "/api/admin/platform-alerts/summary", headers=auth_headers(admin)
            )
            assert resp.status_code == 200, resp.text
            body = resp.json()
            assert body["critical"] >= 1
            assert body["resolved"] >= 1
        finally:
            for row_id in inserted_ids:
                db.table("admin_alerts").delete().eq("id", row_id).execute()

    def test_non_admin_cannot_view_alerts(self, client, make_user, auth_headers):
        investor = make_user(role="investor")
        resp = client.get(
            "/api/admin/platform-alerts", headers=auth_headers(investor)
        )
        assert resp.status_code == 403


class TestSearchAlert:
    def test_price_alerts_listing_includes_real_row(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        alert_owner = make_user(role="investor")
        inserted_id = None
        try:
            result = (
                db.table("price_alerts")
                .insert(
                    {
                        "user_id": alert_owner["id"],
                        "ticker": "TESTX",
                        "target_price": 123.45,
                        "condition": "above",
                        "is_active": True,
                        "is_triggered": False,
                        "is_dismissed": False,
                    }
                )
                .execute()
            )
            inserted_id = result.data[0]["id"] if result.data else None

            resp = client.get("/api/admin/alerts", headers=auth_headers(admin))
            assert resp.status_code == 200, resp.text
            tickers = [a.get("ticker") for a in resp.json()["data"]]
            assert "TESTX" in tickers
        finally:
            if inserted_id:
                db.table("price_alerts").delete().eq("id", inserted_id).execute()


class TestViewAndResolveAlert:
    def test_resolve_persists_and_logs_activity(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        inserted_id = None
        try:
            result = (
                db.table("admin_alerts")
                .insert({"severity": "warning", "is_resolved": False, "message": "Resolvable"})
                .execute()
            )
            inserted_id = result.data[0]["id"] if result.data else None

            resp = client.patch(
                f"/api/admin/platform-alerts/{inserted_id}/resolve",
                headers=auth_headers(admin),
            )
            assert resp.status_code == 200, resp.text

            row = (
                db.table("admin_alerts")
                .select("is_resolved")
                .eq("id", inserted_id)
                .execute()
            )
            assert row.data[0]["is_resolved"] is True

            logs = (
                db.table("activity_logs")
                .select("*")
                .eq("action", "platform_alert_resolved")
                .eq("target_id", inserted_id)
                .execute()
            )
            assert len(logs.data) == 1
            assert logs.data[0]["user_id"] == admin["id"]
        finally:
            if inserted_id:
                db.table("admin_alerts").delete().eq("id", inserted_id).execute()

    def test_resolve_nonexistent_alert_returns_404(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        resp = client.patch(
            "/api/admin/platform-alerts/00000000-0000-0000-0000-000000000000/resolve",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 404


class TestViewActivityLogs:
    def test_activity_log_resolves_real_admin_name_via_join(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin", name="Loggable Admin")
        target = make_user(role="investor")

        # Generate a real, attributable activity log entry.
        suspend = client.patch(
            f"/api/admin/users/{target['id']}/suspend", headers=auth_headers(admin)
        )
        assert suspend.status_code == 200, suspend.text

        resp = client.get(
            "/api/admin/activity-log",
            params={"action": "user_suspended"},
            headers=auth_headers(admin),
        )
        assert resp.status_code == 200, resp.text
        matching = [
            log for log in resp.json()["logs"] if log["target_id"] == target["id"]
        ]
        assert len(matching) == 1
        # This is the join a mock can't verify: admin_name comes from a
        # second real query against users, keyed on the log's user_id.
        assert matching[0]["admin_name"] == "Loggable Admin"

    def test_non_admin_cannot_view_activity_log(self, client, make_user, auth_headers):
        investor = make_user(role="investor")
        resp = client.get(
            "/api/admin/activity-log", headers=auth_headers(investor)
        )
        assert resp.status_code == 403
