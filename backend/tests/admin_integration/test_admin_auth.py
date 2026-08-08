from app.core.security import decodeAccessToken


class TestAdminLogin:
    def test_admin_login_succeeds_and_returns_working_token(self, client, make_user):
        admin = make_user(role="admin")

        resp = client.post(
            "/api/auth/login",
            json={"email": admin["email"], "password": "testing123"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["user"]["role"] == "admin"
        assert "password_hash" not in body["user"]

        payload = decodeAccessToken(body["token"])
        assert payload["sub"] == admin["id"]
        assert payload["role"] == "admin"

        stats = client.get(
            "/api/admin/stats",
            headers={"Authorization": f"Bearer {body['token']}"},
        )
        assert stats.status_code == 200

    def test_admin_login_wrong_password_rejected(self, client, make_user):
        admin = make_user(role="admin")

        resp = client.post(
            "/api/auth/login",
            json={"email": admin["email"], "password": "wrong-password"},
        )
        assert resp.status_code == 401

    def test_suspended_admin_cannot_log_in(self, client, make_user):
        admin = make_user(role="admin", status="suspended")

        resp = client.post(
            "/api/auth/login",
            json={"email": admin["email"], "password": "testing123"},
        )
        assert resp.status_code == 401


class TestAdminLogout:
    def test_logout_clears_session_token_in_database(
        self, client, make_user, db
    ):
        admin = make_user(role="admin")

        login = client.post(
            "/api/auth/login",
            json={"email": admin["email"], "password": "testing123"},
        )
        assert login.status_code == 200
        token = login.json()["token"]

        row = db.table("users").select("session_token").eq(
            "id", admin["id"]
        ).execute()
        assert row.data[0]["session_token"] == token

        logout = client.post(
            "/api/auth/logout", json={"session_token": token}
        )
        assert logout.status_code == 200

        row = db.table("users").select("session_token").eq(
            "id", admin["id"]
        ).execute()
        assert row.data[0]["session_token"] is None


class TestAdminResetPassword:
    def test_reset_password_with_correct_old_password(
        self, client, make_user
    ):
        admin = make_user(role="admin")
        headers = _auth_headers_for(admin)

        resp = client.post(
            "/api/auth/reset-password",
            json={"old_password": "testing123", "new_password": "newpass456"},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text

        old_login = client.post(
            "/api/auth/login",
            json={"email": admin["email"], "password": "testing123"},
        )
        assert old_login.status_code == 401

        new_login = client.post(
            "/api/auth/login",
            json={"email": admin["email"], "password": "newpass456"},
        )
        assert new_login.status_code == 200

    def test_reset_password_with_wrong_old_password_rejected(
        self, client, make_user
    ):
        admin = make_user(role="admin")
        headers = _auth_headers_for(admin)

        resp = client.post(
            "/api/auth/reset-password",
            json={"old_password": "not-the-real-password", "new_password": "newpass456"},
            headers=headers,
        )
        assert resp.status_code == 400

        still_works = client.post(
            "/api/auth/login",
            json={"email": admin["email"], "password": "testing123"},
        )
        assert still_works.status_code == 200


def _auth_headers_for(user: dict) -> dict:
    from app.core.security import createAccessToken

    token = createAccessToken(
        {"sub": user["id"], "email": user["email"], "role": user["role"]}
    )
    return {"Authorization": f"Bearer {token}"}
