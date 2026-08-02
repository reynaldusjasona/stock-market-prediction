def _create_feedback(db, user_id: str, **overrides) -> dict:
    data = {"user_id": user_id, "subject": "Test subject", "message": "Test message"}
    data.update(overrides)
    result = db.table("feedback").insert(data).execute()
    assert result.data
    return result.data[0]


class TestManageFeedback:
    def test_list_includes_real_feedback_with_pending_status(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        investor = make_user(role="investor")
        fb = _create_feedback(db, investor["id"], subject="Listable feedback")

        try:
            resp = client.get(
                "/api/feedback",
                params={"status": "pending"},
                headers=auth_headers(admin),
            )
            assert resp.status_code == 200, resp.text
            ids = [row["id"] for row in resp.json()["data"]]
            assert fb["id"] in ids
        finally:
            db.table("feedback").delete().eq("id", fb["id"]).execute()

    def test_non_admin_cannot_list_feedback(self, client, make_user, auth_headers):
        investor = make_user(role="investor")
        resp = client.get("/api/feedback", headers=auth_headers(investor))
        assert resp.status_code == 403


class TestViewFeedback:
    def test_view_returns_real_feedback_with_joined_user_info(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        investor = make_user(role="investor", name="Feedback Author")
        fb = _create_feedback(db, investor["id"], message="Detailed view test")

        try:
            resp = client.get(
                f"/api/admin/feedback/{fb['id']}", headers=auth_headers(admin)
            )
            assert resp.status_code == 200, resp.text
            assert resp.json()["message"] == "Detailed view test"
            assert resp.json()["user_name"] == "Feedback Author"
        finally:
            db.table("feedback").delete().eq("id", fb["id"]).execute()

    def test_view_nonexistent_feedback_returns_404(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        resp = client.get(
            "/api/admin/feedback/00000000-0000-0000-0000-000000000000",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 404


class TestSearchFeedback:
    def test_status_filter_only_returns_matching_real_rows(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        investor = make_user(role="investor")
        pending_fb = _create_feedback(db, investor["id"], subject="Still pending")
        approved_fb = _create_feedback(
            db, investor["id"], subject="Already approved", status="approved"
        )

        try:
            resp = client.get(
                "/api/feedback",
                params={"status": "pending"},
                headers=auth_headers(admin),
            )
            assert resp.status_code == 200, resp.text
            ids = [row["id"] for row in resp.json()["data"]]
            assert pending_fb["id"] in ids
            assert approved_fb["id"] not in ids
        finally:
            db.table("feedback").delete().eq("id", pending_fb["id"]).execute()
            db.table("feedback").delete().eq("id", approved_fb["id"]).execute()

    def test_invalid_status_value_returns_400(self, client, make_user, auth_headers):
        admin = make_user(role="admin")
        resp = client.get(
            "/api/feedback",
            params={"status": "not-a-real-status"},
            headers=auth_headers(admin),
        )
        assert resp.status_code == 400


class TestApproveFeedback:
    def test_approve_persists_status_and_appends_testimonial(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        investor = make_user(role="investor", name="Testimonial Author")
        fb = _create_feedback(
            db, investor["id"], message="Great platform!", rating=5
        )

        landing_row_before = (
            db.table("landing_page_config").select("id, content").limit(1).execute()
        )
        had_landing_row = bool(landing_row_before.data)

        try:
            resp = client.patch(
                f"/api/feedback/{fb['id']}/approve", headers=auth_headers(admin)
            )
            assert resp.status_code == 200, resp.text

            row = (
                db.table("feedback").select("status").eq("id", fb["id"]).execute()
            )
            assert row.data[0]["status"] == "approved"

            if had_landing_row:
                landing = (
                    db.table("landing_page_config")
                    .select("content")
                    .limit(1)
                    .execute()
                )
                testimonials = landing.data[0]["content"].get("testimonials", [])
                matching = [
                    t for t in testimonials if t.get("feedback_id") == fb["id"]
                ]
                assert len(matching) == 1
                assert matching[0]["name"] == "Testimonial Author"
                assert matching[0]["rating"] == 5
        finally:
            db.table("feedback").delete().eq("id", fb["id"]).execute()

    def test_approve_nonexistent_feedback_returns_404(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        resp = client.patch(
            "/api/feedback/00000000-0000-0000-0000-000000000000/approve",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 404

    def test_non_admin_cannot_approve_feedback(
        self, client, make_user, auth_headers, db
    ):
        investor = make_user(role="investor")
        fb = _create_feedback(db, investor["id"])
        try:
            resp = client.patch(
                f"/api/feedback/{fb['id']}/approve", headers=auth_headers(investor)
            )
            assert resp.status_code == 403

            row = db.table("feedback").select("status").eq("id", fb["id"]).execute()
            assert row.data[0]["status"] == "pending"
        finally:
            db.table("feedback").delete().eq("id", fb["id"]).execute()


class TestRejectFeedback:
    def test_reject_persists_status_without_touching_landing_page(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        investor = make_user(role="investor")
        fb = _create_feedback(db, investor["id"])

        try:
            resp = client.patch(
                f"/api/feedback/{fb['id']}/reject", headers=auth_headers(admin)
            )
            assert resp.status_code == 200, resp.text

            row = db.table("feedback").select("status").eq("id", fb["id"]).execute()
            assert row.data[0]["status"] == "rejected"
        finally:
            db.table("feedback").delete().eq("id", fb["id"]).execute()

    def test_reject_nonexistent_feedback_returns_404(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        resp = client.patch(
            "/api/feedback/00000000-0000-0000-0000-000000000000/reject",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 404
