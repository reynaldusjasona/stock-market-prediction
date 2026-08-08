class TestViewOwnAccount:
    def test_admin_can_view_own_account_via_user_by_id_route(
        self, client, make_user
    ):
        admin = make_user(role="admin", name="Self View Admin")

        resp = client.get(f"/api/auth/user/{admin['id']}")
        assert resp.status_code == 200, resp.text
        assert resp.json()["name"] == "Self View Admin"
        assert resp.json()["role"] == "admin"

    def test_no_dedicated_me_route_exists(self, client, make_user, auth_headers):
        admin = make_user(role="admin")
        resp = client.get("/api/auth/me", headers=auth_headers(admin))
        assert resp.status_code in (404, 405)


class TestManageTraderAccounts:
    def test_pending_trader_appears_in_user_listing(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        pending_trader = make_user(
            role="trader", trader_status="pending", license_number="MAS-000111"
        )

        resp = client.get("/api/admin/users", headers=auth_headers(admin))
        assert resp.status_code == 200, resp.text
        matching = [u for u in resp.json() if u["id"] == pending_trader["id"]]
        assert len(matching) == 1
        assert matching[0]["trader_status"] == "pending"

    def test_pending_trader_cannot_log_in_until_approved(
        self, client, make_user
    ):
        trader = make_user(
            role="trader", trader_status="pending", license_number="MAS-000222"
        )

        resp = client.post(
            "/api/auth/login",
            json={"email": trader["email"], "password": "testing123"},
        )
        assert resp.status_code == 403
        assert "pending" in resp.json()["detail"].lower()


class TestViewAndApproveTrader:
    def test_view_trader_details_shows_license_and_status(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        trader = make_user(
            role="trader",
            trader_status="pending",
            license_number="MAS-000777",
            name="License Review Trader",
        )

        resp = client.get(f"/api/auth/user/{trader['id']}")
        assert resp.status_code == 200, resp.text
        assert resp.json()["name"] == "License Review Trader"
        assert resp.json()["role"] == "trader"
        listing = client.get("/api/admin/users", headers=auth_headers(admin))
        assert listing.status_code == 200, listing.text
        matching = [u for u in listing.json() if u["id"] == trader["id"]]
        assert len(matching) == 1
        assert matching[0]["license_number"] == "MAS-000777"
        assert matching[0]["trader_status"] == "pending"

    def test_approve_trader_persists_status_and_unlocks_login(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        trader = make_user(
            role="trader", trader_status="pending", license_number="MAS-000333"
        )

        resp = client.patch(
            f"/api/admin/users/{trader['id']}/approve-trader",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["trader_status"] == "approved"

        row = (
            db.table("users")
            .select("trader_status")
            .eq("id", trader["id"])
            .execute()
        )
        assert row.data[0]["trader_status"] == "approved"

        logs = (
            db.table("activity_logs")
            .select("*")
            .eq("action", "trader_approved")
            .eq("target_id", trader["id"])
            .execute()
        )
        assert len(logs.data) == 1
        login = client.post(
            "/api/auth/login",
            json={"email": trader["email"], "password": "testing123"},
        )
        assert login.status_code == 200, login.text

    def test_reject_trader_persists_status_and_still_blocks_login(
        self, client, make_user, auth_headers, db
    ):
        admin = make_user(role="admin")
        trader = make_user(
            role="trader", trader_status="pending", license_number="MAS-000444"
        )

        resp = client.patch(
            f"/api/admin/users/{trader['id']}/reject-trader",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 200, resp.text

        row = (
            db.table("users")
            .select("trader_status")
            .eq("id", trader["id"])
            .execute()
        )
        assert row.data[0]["trader_status"] == "rejected"

        login = client.post(
            "/api/auth/login",
            json={"email": trader["email"], "password": "testing123"},
        )
        assert login.status_code == 403
        assert "rejected" in login.json()["detail"].lower()

    def test_approving_already_approved_trader_returns_400(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        trader = make_user(
            role="trader", trader_status="approved", license_number="MAS-000555"
        )

        resp = client.patch(
            f"/api/admin/users/{trader['id']}/approve-trader",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 400

    def test_approving_a_non_trader_user_returns_400(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        investor = make_user(role="investor")

        resp = client.patch(
            f"/api/admin/users/{investor['id']}/approve-trader",
            headers=auth_headers(admin),
        )
        assert resp.status_code == 400

    def test_non_admin_cannot_approve_traders(self, client, make_user, auth_headers):
        non_admin = make_user(role="investor")
        trader = make_user(role="trader", trader_status="pending")

        resp = client.patch(
            f"/api/admin/users/{trader['id']}/approve-trader",
            headers=auth_headers(non_admin),
        )
        assert resp.status_code == 403

    def test_verify_license_recognises_real_mas_prefix(
        self, client, make_user, auth_headers
    ):
        admin = make_user(role="admin")
        resp = client.get(
            "/api/admin/verify-license",
            params={"number": "MAS-000999"},
            headers=auth_headers(admin),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["valid"] is True
        assert resp.json()["authority"] == "MAS Singapore"
