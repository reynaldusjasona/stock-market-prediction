class TestUpdateLandingPage:
    def test_update_persists_and_round_trips_through_get(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")

        new_content = {
            "hero": {
                "tag": "Integration Test Tag",
                "headline": "Test Headline",
                "subline": "",
                "cta_label": "",
                "secondary_label": "",
            },
            "about": {"subtitle": "", "cards": []},
            "features": {"subtitle": "", "items": []},
            "testimonials": [],
            "subscription": {
                "title": "", "subtitle": "", "plan_name": "", "price": "",
                "period": "", "bullets": [], "cta_label": "", "footnote": "",
            },
            "faqs": [],
        }

        put_resp = client.put(
            "/api/admin/landing", json=new_content, headers=auth_headers(admin)
        )
        assert put_resp.status_code == 200, put_resp.text
        assert put_resp.json()["content"]["hero"]["tag"] == "Integration Test Tag"

        get_resp = client.get("/api/admin/landing", headers=auth_headers(admin))
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.json()["hero"]["headline"] == "Test Headline"
        logs = (
            db.table("activity_logs")
            .select("*")
            .eq("action", "landing_updated")
            .eq("user_id", admin["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        assert len(logs.data) >= 1

    def test_non_admin_cannot_update_landing_page(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")

        resp = client.put(
            "/api/admin/landing",
            json={"hero": {"headline": "Hacked"}},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 403


class TestModelPerformanceAndQuality:
    def test_model_performance_reflects_latest_real_metrics_row(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        inserted_id = None
        try:
            inserted = (
                db.table("prediction_metrics")
                .insert(
                    {
                        "accuracy": 0.7777,
                        "recall_score": 0.6,
                        "f1_score": 0.65,
                        "model_version": "test-v9",
                        "evaluated_at": "2026-08-01T00:00:00Z",
                    }
                )
                .execute()
            )
            inserted_id = inserted.data[0]["id"] if inserted.data else None

            resp = client.get(
                "/api/admin/model/performance", headers=auth_headers(admin)
            )
            assert resp.status_code == 200, resp.text
            assert resp.json()["accuracy"] == 0.7777
            assert resp.json()["model_version"] == "test-v9"
        finally:
            if inserted_id:
                db.table("prediction_metrics").delete().eq(
                    "id", inserted_id
                ).execute()

    def test_model_quality_reflects_real_class_metrics(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        inserted_ids = []
        try:
            for row in (
                {"class_name": "Buy", "precision_score": 0.9, "recall_score": 0.8,
                 "f1_score": 0.85, "support": 100},
                {"class_name": "Sell", "precision_score": 0.4, "recall_score": 0.3,
                 "f1_score": 0.34, "support": 50},
            ):
                result = db.table("model_class_metrics").insert(row).execute()
                if result.data:
                    inserted_ids.append(result.data[0]["id"])

            resp = client.get(
                "/api/admin/model/quality", headers=auth_headers(admin)
            )
            assert resp.status_code == 200, resp.text
            classes = {c["class_name"]: c for c in resp.json()["classes"]}
            assert classes["Buy"]["precision"] == 0.9
            assert classes["Sell"]["recall"] == 0.3
        finally:
            for row_id in inserted_ids:
                db.table("model_class_metrics").delete().eq("id", row_id).execute()

    def test_non_admin_cannot_view_model_performance(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")
        resp = client.get(
            "/api/admin/model/performance", headers=auth_headers(investor)
        )
        assert resp.status_code == 403


class TestModelRetrain:
    def test_retrain_request_persists_and_is_reflected_in_status(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")

        resp = client.post(
            "/api/admin/model/retrain", headers=auth_headers(admin)
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "queued"
        status_resp = client.get(
            "/api/admin/model/retrain/status", headers=auth_headers(admin)
        )
        assert status_resp.status_code == 200, status_resp.text
        assert status_resp.json()["status"] == "queued"
        assert status_resp.json()["last_request"] is not None

        logs = (
            db.table("activity_logs")
            .select("*")
            .eq("action", "model_retrain_requested")
            .eq("user_id", admin["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        assert len(logs.data) >= 1
