class TestPlans:
    def test_get_plans_returns_investor_plan(self, client):
        resp = client.get("/api/subscription/plans")
        assert resp.status_code == 200, resp.text
        plan_ids = [p["id"] for p in resp.json()]
        assert "investor" in plan_ids


class TestSubscribeAndCancel:
    def test_subscribe_creates_active_subscription(
        self, client, make_user, auth_headers, db
    ):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/subscription",
            json={"plan": "investor"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "active"
        assert body["plan"] == "investor"

        row = db.table("subscriptions").select("*").eq(
            "user_id", investor["id"]
        ).eq("status", "active").execute()
        assert row.data

    def test_subscribing_twice_returns_409(self, client, make_user, auth_headers):
        investor = make_user(role="investor")
        client.post(
            "/api/subscription",
            json={"plan": "investor"},
            headers=auth_headers(investor),
        )

        resp = client.post(
            "/api/subscription",
            json={"plan": "investor"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 409

    def test_trader_cannot_subscribe(self, client, make_user, auth_headers):
        trader = make_user(
            role="trader", trader_status="approved", license_number="MAS-777777"
        )

        resp = client.post(
            "/api/subscription",
            json={"plan": "investor"},
            headers=auth_headers(trader),
        )
        assert resp.status_code == 400

    def test_invalid_plan_returns_400(self, client, make_user, auth_headers):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/subscription",
            json={"plan": "not-a-real-plan"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 400

    def test_get_subscription_returns_active_row(self, client, make_user, auth_headers):
        investor = make_user(role="investor")
        client.post(
            "/api/subscription",
            json={"plan": "investor"},
            headers=auth_headers(investor),
        )

        resp = client.get("/api/subscription", headers=auth_headers(investor))
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "active"

    def test_cancel_subscription_success(self, client, make_user, auth_headers, db):
        investor = make_user(role="investor")
        client.post(
            "/api/subscription",
            json={"plan": "investor"},
            headers=auth_headers(investor),
        )

        resp = client.post("/api/subscription/cancel", headers=auth_headers(investor))
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "cancelled"

        row = db.table("subscriptions").select("status").eq(
            "user_id", investor["id"]
        ).execute().data[0]
        assert row["status"] == "cancelled"

    def test_cancel_without_active_subscription_returns_404(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")

        resp = client.post("/api/subscription/cancel", headers=auth_headers(investor))
        assert resp.status_code == 404


class TestCheckoutMockMode:
    def test_checkout_returns_mock_success_url_when_stripe_unconfigured(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")

        resp = client.post("/api/subscription/checkout", headers=auth_headers(investor))
        assert resp.status_code == 200, resp.text
        assert "mock_session" in resp.json()["checkout_url"]


class TestSignalAccess:
    def test_signal_access_checkout_requires_active_subscription(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/subscription/signal-access/checkout", headers=auth_headers(investor)
        )
        assert resp.status_code == 400

    def test_signal_access_checkout_mock_mode_activates_directly(
        self, client, make_user, auth_headers, db
    ):
        investor = make_user(role="investor")
        client.post(
            "/api/subscription",
            json={"plan": "investor"},
            headers=auth_headers(investor),
        )

        resp = client.post(
            "/api/subscription/signal-access/checkout", headers=auth_headers(investor)
        )
        assert resp.status_code == 200, resp.text
        assert "mock mode" in resp.json()["message"]

        status_resp = client.get(
            "/api/subscription/signal-access/status", headers=auth_headers(investor)
        )
        assert status_resp.json()["has_signal_access"] is True

    def test_signal_access_cancel(self, client, make_user, auth_headers, grant_signal_access):
        investor = make_user(role="investor")
        grant_signal_access(investor["id"])

        resp = client.post(
            "/api/subscription/signal-access/cancel", headers=auth_headers(investor)
        )
        assert resp.status_code == 200, resp.text

        status_resp = client.get(
            "/api/subscription/signal-access/status", headers=auth_headers(investor)
        )
        assert status_resp.json()["has_signal_access"] is False

    def test_signal_access_cancel_404_when_no_subscription(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/subscription/signal-access/cancel", headers=auth_headers(investor)
        )
        assert resp.status_code == 404
