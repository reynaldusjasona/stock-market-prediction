def _insert_notification(db, user_id, **overrides):
    data = {
        "user_id": user_id,
        "title": "Test Notification",
        "message": "This is a test notification.",
        "type": "system",
        "is_read": False,
    }
    data.update(overrides)
    result = db.table("notifications").insert(data).execute()
    assert result.data, f"failed to insert test notification: {data}"
    return result.data[0]


class TestNotifications:
    def test_list_notifications_returns_only_own(self, client, make_user, auth_headers, db):
        investor = make_user(role="investor")
        other = make_user(role="investor")
        mine = _insert_notification(db, investor["id"], title="Mine")
        _insert_notification(db, other["id"], title="Not mine")

        resp = client.get("/api/notifications", headers=auth_headers(investor))
        assert resp.status_code == 200, resp.text
        ids = [row["id"] for row in resp.json()]
        assert mine["id"] in ids
        assert all(row["user_id"] == investor["id"] for row in resp.json())

    def test_mark_as_read_success(self, client, make_user, auth_headers, db):
        investor = make_user(role="investor")
        notification = _insert_notification(db, investor["id"])

        resp = client.patch(
            f"/api/notifications/{notification['id']}/read",
            headers=auth_headers(investor),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["success"] is True

        row = db.table("notifications").select("is_read").eq(
            "id", notification["id"]
        ).execute().data[0]
        assert row["is_read"] is True

    def test_mark_as_read_404_for_other_users_notification(
        self, client, make_user, auth_headers, db
    ):
        investor = make_user(role="investor")
        other = make_user(role="investor")
        notification = _insert_notification(db, other["id"])

        resp = client.patch(
            f"/api/notifications/{notification['id']}/read",
            headers=auth_headers(investor),
        )
        assert resp.status_code == 404

    def test_send_pending_email_returns_sent_true(self, client, make_user, auth_headers, db):
        investor = make_user(role="investor")
        _insert_notification(db, investor["id"], is_read=False)

        resp = client.post(
            "/api/notifications/send-pending-email", headers=auth_headers(investor)
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["sent"] is True
