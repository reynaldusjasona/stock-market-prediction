import uuid


class TestCreateFeedback:
    def test_create_feedback_persists_to_database(self, client, make_user, auth_headers, db):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/feedback",
            json={
                "subject": f"Test subject {uuid.uuid4().hex[:6]}",
                "message": "This is a test feedback message.",
                "rating": 5,
            },
            headers=auth_headers(investor),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["user_id"] == investor["id"]
        assert body["rating"] == 5

        row = db.table("feedback").select("*").eq("id", body["id"]).execute().data[0]
        assert row["user_id"] == investor["id"]
        assert row["status"] == "pending"

    def test_create_feedback_without_rating(self, client, make_user, auth_headers):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/feedback",
            json={
                "subject": f"No rating {uuid.uuid4().hex[:6]}",
                "message": "Feedback without a rating.",
            },
            headers=auth_headers(investor),
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["rating"] is None

    def test_create_feedback_non_investor_returns_403(
        self, client, make_user, auth_headers
    ):
        trader = make_user(
            role="trader", trader_status="approved", license_number="MAS-555444"
        )

        resp = client.post(
            "/api/feedback",
            json={"subject": "Not allowed", "message": "Should be forbidden."},
            headers=auth_headers(trader),
        )
        assert resp.status_code == 403
