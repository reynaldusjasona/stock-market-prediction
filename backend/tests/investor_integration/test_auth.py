from datetime import datetime, timedelta, timezone

from app.core.security import createAccessToken, decodeAccessToken


def _headers(user: dict) -> dict:
    token = createAccessToken(
        {"sub": user["id"], "email": user["email"], "role": user["role"]}
    )
    return {"Authorization": f"Bearer {token}"}


def _cleanup_user_by_email(db, email: str) -> None:
    # register creates a user outside make_user's tracked created_ids, so
    # this mirrors conftest._delete_user's full child-first ordering rather
    # than just deleting the users row - login() (called by some of these
    # tests after verifying OTP) writes an activity_logs row, which would
    # otherwise violate activity_logs_user_id_fkey on delete.
    result = db.table("users").select("id").eq("email", email).execute()
    for row in result.data or []:
        user_id = row["id"]
        db.table("stock_inquiries").delete().eq("investor_id", user_id).execute()
        db.table("stock_inquiries").delete().eq("trader_id", user_id).execute()
        db.table("trader_clients").delete().eq("investor_id", user_id).execute()
        db.table("trader_clients").delete().eq("trader_id", user_id).execute()
        db.table("subscriptions").delete().eq("user_id", user_id).execute()
        db.table("notifications").delete().eq("user_id", user_id).execute()
        db.table("price_alerts").delete().eq("user_id", user_id).execute()
        db.table("portfolio").delete().eq("user_id", user_id).execute()
        db.table("watchlist").delete().eq("user_id", user_id).execute()
        db.table("feedback").delete().eq("user_id", user_id).execute()
        db.table("activity_logs").delete().eq("user_id", user_id).execute()
        db.table("activity_logs").delete().eq("target_id", user_id).execute()
        db.table("users").delete().eq("id", user_id).execute()


class TestLogin:
    def test_login_succeeds_and_returns_working_token(self, client, make_user):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/auth/login",
            json={"email": investor["email"], "password": "testing123"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["user"]["role"] == "investor"
        assert "password_hash" not in body["user"]

        payload = decodeAccessToken(body["token"])
        assert payload["sub"] == investor["id"]
        assert payload["role"] == "investor"

    def test_login_wrong_password_rejected(self, client, make_user):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/auth/login",
            json={"email": investor["email"], "password": "wrong-password"},
        )
        assert resp.status_code == 401

    def test_login_unverified_user_rejected(self, client, make_user):
        investor = make_user(role="investor", is_verified=False)

        resp = client.post(
            "/api/auth/login",
            json={"email": investor["email"], "password": "testing123"},
        )
        assert resp.status_code == 403

    def test_login_suspended_user_rejected(self, client, make_user):
        investor = make_user(role="investor", status="suspended")

        resp = client.post(
            "/api/auth/login",
            json={"email": investor["email"], "password": "testing123"},
        )
        assert resp.status_code == 401

    def test_login_pending_trader_rejected(self, client, make_user):
        trader = make_user(
            role="trader",
            trader_status="pending",
            license_number="MAS-000111",
        )

        resp = client.post(
            "/api/auth/login",
            json={"email": trader["email"], "password": "testing123"},
        )
        assert resp.status_code == 403


class TestLogout:
    def test_logout_clears_session_token_in_database(self, client, make_user, db):
        investor = make_user(role="investor")

        login = client.post(
            "/api/auth/login",
            json={"email": investor["email"], "password": "testing123"},
        )
        assert login.status_code == 200
        token = login.json()["token"]

        row = db.table("users").select("session_token").eq(
            "id", investor["id"]
        ).execute()
        assert row.data[0]["session_token"] == token

        logout = client.post("/api/auth/logout", json={"session_token": token})
        assert logout.status_code == 200

        row = db.table("users").select("session_token").eq(
            "id", investor["id"]
        ).execute()
        assert row.data[0]["session_token"] is None


class TestResetPassword:
    def test_reset_password_with_correct_old_password(self, client, make_user):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/auth/reset-password",
            json={"old_password": "testing123", "new_password": "newpass456"},
            headers=_headers(investor),
        )
        assert resp.status_code == 200, resp.text

        old_login = client.post(
            "/api/auth/login",
            json={"email": investor["email"], "password": "testing123"},
        )
        assert old_login.status_code == 401

        new_login = client.post(
            "/api/auth/login",
            json={"email": investor["email"], "password": "newpass456"},
        )
        assert new_login.status_code == 200

    def test_reset_password_with_wrong_old_password_rejected(self, client, make_user):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/auth/reset-password",
            json={
                "old_password": "not-the-real-password",
                "new_password": "newpass456",
            },
            headers=_headers(investor),
        )
        assert resp.status_code == 400

        still_works = client.post(
            "/api/auth/login",
            json={"email": investor["email"], "password": "testing123"},
        )
        assert still_works.status_code == 200


class TestRegisterAndVerifyOtp:
    def test_register_creates_unverified_user_with_otp_and_blocks_login(
        self, client, db
    ):
        email = "register_" + datetime.now(timezone.utc).strftime("%H%M%S%f")
        email = f"{email}@integration-test.local"
        try:
            resp = client.post(
                "/api/auth/register",
                json={
                    "name": "New Investor",
                    "email": email,
                    "password": "testing123",
                    "role": "investor",
                },
            )
            assert resp.status_code == 200, resp.text
            body = resp.json()
            assert body["user_id"]

            row = db.table("users").select(
                "is_verified, register_otp_code, register_otp_expires_at"
            ).eq("id", body["user_id"]).execute().data[0]
            assert row["is_verified"] is False
            assert row["register_otp_code"] is not None
            assert len(row["register_otp_code"]) == 6
            assert row["register_otp_expires_at"] is not None

            blocked_login = client.post(
                "/api/auth/login",
                json={"email": email, "password": "testing123"},
            )
            assert blocked_login.status_code == 403
        finally:
            _cleanup_user_by_email(db, email)

    def test_verify_register_otp_success_allows_login(self, client, db):
        email = "verifyok_" + datetime.now(timezone.utc).strftime("%H%M%S%f")
        email = f"{email}@integration-test.local"
        try:
            client.post(
                "/api/auth/register",
                json={
                    "name": "Verify OK",
                    "email": email,
                    "password": "testing123",
                    "role": "investor",
                },
            )
            otp_code = db.table("users").select("register_otp_code").eq(
                "email", email
            ).execute().data[0]["register_otp_code"]

            resp = client.post(
                "/api/auth/verify-register-otp",
                json={"email": email, "code": otp_code},
            )
            assert resp.status_code == 200, resp.text

            row = db.table("users").select(
                "is_verified, register_otp_code"
            ).eq("email", email).execute().data[0]
            assert row["is_verified"] is True
            assert row["register_otp_code"] is None

            login = client.post(
                "/api/auth/login",
                json={"email": email, "password": "testing123"},
            )
            assert login.status_code == 200
        finally:
            _cleanup_user_by_email(db, email)

    def test_verify_register_otp_wrong_code_returns_401(self, client, db):
        email = "verifybad_" + datetime.now(timezone.utc).strftime("%H%M%S%f")
        email = f"{email}@integration-test.local"
        try:
            client.post(
                "/api/auth/register",
                json={
                    "name": "Verify Bad",
                    "email": email,
                    "password": "testing123",
                    "role": "investor",
                },
            )
            resp = client.post(
                "/api/auth/verify-register-otp",
                json={"email": email, "code": "000000"},
            )
            assert resp.status_code == 401
        finally:
            _cleanup_user_by_email(db, email)

    def test_verify_register_otp_expired_returns_401(self, client, db):
        email = "verifyexp_" + datetime.now(timezone.utc).strftime("%H%M%S%f")
        email = f"{email}@integration-test.local"
        try:
            client.post(
                "/api/auth/register",
                json={
                    "name": "Verify Expired",
                    "email": email,
                    "password": "testing123",
                    "role": "investor",
                },
            )
            otp_code = db.table("users").select("register_otp_code").eq(
                "email", email
            ).execute().data[0]["register_otp_code"]

            past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            db.table("users").update({"register_otp_expires_at": past}).eq(
                "email", email
            ).execute()

            resp = client.post(
                "/api/auth/verify-register-otp",
                json={"email": email, "code": otp_code},
            )
            assert resp.status_code == 401
        finally:
            _cleanup_user_by_email(db, email)


class TestForgotPasswordOtp:
    def test_forgot_password_issues_otp_for_verified_active_investor(
        self, client, make_user, db
    ):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/auth/forgot-password", json={"email": investor["email"]}
        )
        assert resp.status_code == 200

        row = db.table("users").select(
            "reset_otp_code, reset_otp_expires_at"
        ).eq("id", investor["id"]).execute().data[0]
        assert row["reset_otp_code"] is not None
        assert len(row["reset_otp_code"]) == 6
        assert row["reset_otp_expires_at"] is not None

    def test_forgot_password_noops_for_unverified_investor(
        self, client, make_user, db
    ):
        investor = make_user(role="investor", is_verified=False)

        resp = client.post(
            "/api/auth/forgot-password", json={"email": investor["email"]}
        )
        assert resp.status_code == 200

        row = db.table("users").select("reset_otp_code").eq(
            "id", investor["id"]
        ).execute().data[0]
        assert row["reset_otp_code"] is None

    def test_verify_reset_otp_success_returns_reset_token(
        self, client, make_user, db
    ):
        investor = make_user(role="investor")
        client.post("/api/auth/forgot-password", json={"email": investor["email"]})
        otp_code = db.table("users").select("reset_otp_code").eq(
            "id", investor["id"]
        ).execute().data[0]["reset_otp_code"]

        resp = client.post(
            "/api/auth/verify-reset-otp",
            json={"email": investor["email"], "code": otp_code},
        )
        assert resp.status_code == 200, resp.text
        reset_token = resp.json()["reset_token"]
        assert reset_token

        row = db.table("users").select(
            "reset_token, reset_otp_code"
        ).eq("id", investor["id"]).execute().data[0]
        assert row["reset_token"] == reset_token
        assert row["reset_otp_code"] is None

    def test_verify_reset_otp_wrong_code_returns_401(self, client, make_user):
        investor = make_user(role="investor")
        client.post("/api/auth/forgot-password", json={"email": investor["email"]})

        resp = client.post(
            "/api/auth/verify-reset-otp",
            json={"email": investor["email"], "code": "000000"},
        )
        assert resp.status_code == 401

    def test_reset_password_with_token_success(self, client, make_user, db):
        investor = make_user(role="investor")
        client.post("/api/auth/forgot-password", json={"email": investor["email"]})
        otp_code = db.table("users").select("reset_otp_code").eq(
            "id", investor["id"]
        ).execute().data[0]["reset_otp_code"]
        reset_token = client.post(
            "/api/auth/verify-reset-otp",
            json={"email": investor["email"], "code": otp_code},
        ).json()["reset_token"]

        resp = client.post(
            "/api/auth/reset-password-with-token",
            json={"reset_token": reset_token, "new_password": "brandnew789"},
        )
        assert resp.status_code == 200, resp.text

        new_login = client.post(
            "/api/auth/login",
            json={"email": investor["email"], "password": "brandnew789"},
        )
        assert new_login.status_code == 200

        old_login = client.post(
            "/api/auth/login",
            json={"email": investor["email"], "password": "testing123"},
        )
        assert old_login.status_code == 401

    def test_reset_password_with_expired_token_returns_401(
        self, client, make_user, db
    ):
        investor = make_user(role="investor")
        client.post("/api/auth/forgot-password", json={"email": investor["email"]})
        otp_code = db.table("users").select("reset_otp_code").eq(
            "id", investor["id"]
        ).execute().data[0]["reset_otp_code"]
        reset_token = client.post(
            "/api/auth/verify-reset-otp",
            json={"email": investor["email"], "code": otp_code},
        ).json()["reset_token"]

        past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        db.table("users").update({"reset_token_expires_at": past}).eq(
            "id", investor["id"]
        ).execute()

        resp = client.post(
            "/api/auth/reset-password-with-token",
            json={"reset_token": reset_token, "new_password": "brandnew789"},
        )
        assert resp.status_code == 401


class TestLoginOtp:
    def test_request_login_otp_returns_challenge_and_writes_code(
        self, client, make_user, db
    ):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/auth/request-login-otp",
            json={"email": investor["email"], "password": "testing123"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["login_challenge"]

        row = db.table("users").select(
            "login_otp_code, login_challenge_token"
        ).eq("id", investor["id"]).execute().data[0]
        assert row["login_otp_code"] is not None
        assert row["login_challenge_token"] == resp.json()["login_challenge"]

    def test_request_login_otp_wrong_password_returns_401(self, client, make_user):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/auth/request-login-otp",
            json={"email": investor["email"], "password": "wrong-password"},
        )
        assert resp.status_code == 401

    def test_request_login_otp_rejects_admin(self, client, make_user):
        admin = make_user(role="admin")

        resp = client.post(
            "/api/auth/request-login-otp",
            json={"email": admin["email"], "password": "testing123"},
        )
        assert resp.status_code == 403

    def test_verify_login_otp_success_returns_token_and_clears_fields(
        self, client, make_user, db
    ):
        investor = make_user(role="investor")
        challenge = client.post(
            "/api/auth/request-login-otp",
            json={"email": investor["email"], "password": "testing123"},
        ).json()["login_challenge"]
        otp_code = db.table("users").select("login_otp_code").eq(
            "id", investor["id"]
        ).execute().data[0]["login_otp_code"]

        resp = client.post(
            "/api/auth/verify-login-otp",
            json={"login_challenge": challenge, "code": otp_code},
        )
        assert resp.status_code == 200, resp.text
        token = resp.json()["token"]
        assert decodeAccessToken(token)["sub"] == investor["id"]

        row = db.table("users").select(
            "session_token, login_challenge_token, login_otp_code"
        ).eq("id", investor["id"]).execute().data[0]
        assert row["session_token"] == token
        assert row["login_challenge_token"] is None
        assert row["login_otp_code"] is None

    def test_verify_login_otp_wrong_code_returns_401(self, client, make_user):
        investor = make_user(role="investor")
        challenge = client.post(
            "/api/auth/request-login-otp",
            json={"email": investor["email"], "password": "testing123"},
        ).json()["login_challenge"]

        resp = client.post(
            "/api/auth/verify-login-otp",
            json={"login_challenge": challenge, "code": "000000"},
        )
        assert resp.status_code == 401

    def test_verify_login_otp_expired_returns_401(self, client, make_user, db):
        investor = make_user(role="investor")
        challenge = client.post(
            "/api/auth/request-login-otp",
            json={"email": investor["email"], "password": "testing123"},
        ).json()["login_challenge"]
        otp_code = db.table("users").select("login_otp_code").eq(
            "id", investor["id"]
        ).execute().data[0]["login_otp_code"]

        past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        db.table("users").update({"login_otp_expires_at": past}).eq(
            "id", investor["id"]
        ).execute()

        resp = client.post(
            "/api/auth/verify-login-otp",
            json={"login_challenge": challenge, "code": otp_code},
        )
        assert resp.status_code == 401
