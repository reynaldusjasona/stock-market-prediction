import uuid


def _make_trader(make_user, **overrides):
    defaults = {
        "role": "trader",
        "trader_status": "approved",
        "license_number": f"MAS-{uuid.uuid4().hex[:8].upper()}",
    }
    defaults.update(overrides)
    return make_user(**defaults)


class TestBrowseTraders:
    def test_traders_list_forbidden_for_non_investor(self, client, make_user, auth_headers):
        trader = _make_trader(make_user)

        resp = client.get("/api/traders", headers=auth_headers(trader))
        assert resp.status_code == 403

    def test_traders_list_returns_approved_trader_no_signal_access_needed(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")
        trader = _make_trader(make_user)

        resp = client.get("/api/traders", headers=auth_headers(investor))
        assert resp.status_code == 200, resp.text
        trader_ids = [t["id"] for t in resp.json()["traders"]]
        assert trader["id"] in trader_ids


class TestEngagement:
    def test_engage_without_signal_access_returns_403(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")
        trader = _make_trader(make_user)

        resp = client.post(
            "/api/investor/engagements",
            json={"trader_id": trader["id"]},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 403

    def test_engage_trader_success(
        self, client, make_user, auth_headers, grant_signal_access, db
    ):
        investor = make_user(role="investor")
        trader = _make_trader(make_user)
        grant_signal_access(investor["id"])

        resp = client.post(
            "/api/investor/engagements",
            json={"trader_id": trader["id"]},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["engagement"]["status"] == "active"

        row = db.table("trader_clients").select("*").eq(
            "investor_id", investor["id"]
        ).eq("trader_id", trader["id"]).execute().data[0]
        assert row["status"] == "active"

    def test_engage_same_trader_twice_returns_409(
        self, client, make_user, auth_headers, grant_signal_access
    ):
        investor = make_user(role="investor")
        trader = _make_trader(make_user)
        grant_signal_access(investor["id"])
        client.post(
            "/api/investor/engagements",
            json={"trader_id": trader["id"]},
            headers=auth_headers(investor),
        )

        resp = client.post(
            "/api/investor/engagements",
            json={"trader_id": trader["id"]},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 409

    def test_engage_different_trader_while_active_returns_409(
        self, client, make_user, auth_headers, grant_signal_access
    ):
        investor = make_user(role="investor")
        trader_a = _make_trader(make_user)
        trader_b = _make_trader(make_user)
        grant_signal_access(investor["id"])
        client.post(
            "/api/investor/engagements",
            json={"trader_id": trader_a["id"]},
            headers=auth_headers(investor),
        )

        resp = client.post(
            "/api/investor/engagements",
            json={"trader_id": trader_b["id"]},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 409

    def test_reengage_after_disconnect_reactivates(
        self, client, make_user, auth_headers, grant_signal_access, db
    ):
        investor = make_user(role="investor")
        trader = _make_trader(make_user)
        grant_signal_access(investor["id"])
        engage = client.post(
            "/api/investor/engagements",
            json={"trader_id": trader["id"]},
            headers=auth_headers(investor),
        ).json()["engagement"]

        client.delete(
            f"/api/investor/engagements/{engage['id']}", headers=auth_headers(investor)
        )

        resp = client.post(
            "/api/investor/engagements",
            json={"trader_id": trader["id"]},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 200, resp.text

        row = db.table("trader_clients").select("status").eq(
            "id", engage["id"]
        ).execute().data[0]
        assert row["status"] == "active"

    def test_get_own_engagement_includes_trader_details(
        self, client, make_user, auth_headers, grant_signal_access
    ):
        investor = make_user(role="investor")
        trader = _make_trader(make_user)
        grant_signal_access(investor["id"])
        client.post(
            "/api/investor/engagements",
            json={"trader_id": trader["id"]},
            headers=auth_headers(investor),
        )

        resp = client.get("/api/investor/engagements/me", headers=auth_headers(investor))
        assert resp.status_code == 200, resp.text
        engagements = resp.json()["engagements"]
        assert engagements[0]["trader"]["id"] == trader["id"]

    def test_end_engagement_success_and_404_for_unknown_id(
        self, client, make_user, auth_headers, grant_signal_access, db
    ):
        investor = make_user(role="investor")
        trader = _make_trader(make_user)
        grant_signal_access(investor["id"])
        engage = client.post(
            "/api/investor/engagements",
            json={"trader_id": trader["id"]},
            headers=auth_headers(investor),
        ).json()["engagement"]

        resp = client.delete(
            f"/api/investor/engagements/{engage['id']}", headers=auth_headers(investor)
        )
        assert resp.status_code == 200, resp.text

        row = db.table("trader_clients").select("status").eq(
            "id", engage["id"]
        ).execute().data[0]
        assert row["status"] == "inactive"

        missing = client.delete(
            "/api/investor/engagements/00000000-0000-0000-0000-000000000000",
            headers=auth_headers(investor),
        )
        assert missing.status_code == 404


class TestStockInquiries:
    def test_stock_inquiry_requires_active_engagement(
        self, client, make_user, auth_headers, grant_signal_access
    ):
        investor = make_user(role="investor")
        trader = _make_trader(make_user)
        grant_signal_access(investor["id"])

        resp = client.post(
            "/api/investor/stock-inquiries",
            json={"trader_id": trader["id"], "ticker": "AAPL", "message": "Thoughts?"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 403

    def test_stock_inquiry_success_when_connected(
        self, client, make_user, make_stock, auth_headers, grant_signal_access
    ):
        investor = make_user(role="investor")
        trader = _make_trader(make_user)
        stock = make_stock()
        grant_signal_access(investor["id"])
        client.post(
            "/api/investor/engagements",
            json={"trader_id": trader["id"]},
            headers=auth_headers(investor),
        )

        resp = client.post(
            "/api/investor/stock-inquiries",
            json={
                "trader_id": trader["id"],
                "ticker": stock["ticker"],
                "message": "Thoughts?",
            },
            headers=auth_headers(investor),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["inquiry"]["ticker"] == stock["ticker"]

        list_resp = client.get(
            "/api/investor/stock-inquiries", headers=auth_headers(investor)
        )
        assert list_resp.status_code == 200
        assert any(
            inq["trader_id"] == trader["id"] for inq in list_resp.json()["inquiries"]
        )
