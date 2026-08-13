class TestGetAccount:
    def test_get_user_details_returns_public_fields(self, client, make_user):
        investor = make_user(role="investor", phone="555-1234")

        resp = client.get(f"/api/auth/user/{investor['id']}")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["id"] == investor["id"]
        assert body["email"] == investor["email"]
        assert "password_hash" not in body

    def test_get_user_details_404_for_unknown_id(self, client):
        resp = client.get("/api/auth/user/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


class TestUpdateAccount:
    def test_update_account_persists_to_database(self, client, make_user, db, auth_headers):
        investor = make_user(role="investor")

        resp = client.put(
            f"/api/auth/user/{investor['id']}",
            json={"name": "Updated Name", "bio": "New bio", "phone": "555-9999"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["name"] == "Updated Name"
        assert "password_hash" not in body

        row = db.table("users").select("name, bio, phone").eq(
            "id", investor["id"]
        ).execute().data[0]
        assert row["name"] == "Updated Name"
        assert row["bio"] == "New bio"
        assert row["phone"] == "555-9999"

    def test_update_account_other_user_returns_403(self, client, make_user, auth_headers):
        investor = make_user(role="investor")
        other = make_user(role="investor")

        resp = client.put(
            f"/api/auth/user/{other['id']}",
            json={"name": "Hijacked"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 403

    def test_update_account_password_too_short_returns_400(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")

        resp = client.put(
            f"/api/auth/user/{investor['id']}",
            json={"password": "short"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 400

    def test_update_account_password_persists_and_allows_login(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")

        resp = client.put(
            f"/api/auth/user/{investor['id']}",
            json={"password": "newpassword1"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 200, resp.text

        login = client.post(
            "/api/auth/login",
            json={"email": investor["email"], "password": "newpassword1"},
        )
        assert login.status_code == 200

    def test_update_account_no_fields_returns_400(self, client, make_user, auth_headers):
        investor = make_user(role="investor")

        resp = client.put(
            f"/api/auth/user/{investor['id']}",
            json={},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 400


class TestRiskToleranceAndPreferences:
    def test_update_and_get_risk_tolerance_round_trip(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")

        put_resp = client.put(
            f"/api/auth/user/{investor['id']}/risk-tolerance",
            json={"level": "high"},
            headers=auth_headers(investor),
        )
        assert put_resp.status_code == 200, put_resp.text

        get_resp = client.get(
            f"/api/auth/user/{investor['id']}/risk-tolerance",
            headers=auth_headers(investor),
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["risk_tolerance"] == "high"

    def test_update_preferences_round_trip(self, client, make_user, auth_headers):
        investor = make_user(role="investor")

        put_resp = client.put(
            f"/api/auth/user/{investor['id']}/preferences",
            json={"preferences": ["tech", "energy"]},
            headers=auth_headers(investor),
        )
        assert put_resp.status_code == 200, put_resp.text

        get_resp = client.get(
            f"/api/auth/user/{investor['id']}/preferences",
            headers=auth_headers(investor),
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["sector_preferences"] == ["tech", "energy"]
