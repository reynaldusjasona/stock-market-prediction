class TestAlerts:
    def test_create_alert_success(self, client, make_user, make_stock, auth_headers, db):
        investor = make_user(role="investor")
        stock = make_stock()

        resp = client.post(
            f"/api/alerts/{stock['ticker']}",
            json={"target_price": 123.45, "condition": "above"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["ticker"] == stock["ticker"]
        assert body["condition"] == "above"

        row = db.table("price_alerts").select("*").eq(
            "user_id", investor["id"]
        ).eq("ticker", stock["ticker"]).execute()
        assert row.data

    def test_create_alert_untracked_ticker_returns_400(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")

        resp = client.post(
            "/api/alerts/NOTASTOCK",
            json={"target_price": 10.0, "condition": "above"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 400
        assert "not a tracked stock" in resp.json()["detail"]

    def test_create_alert_invalid_condition_returns_400(
        self, client, make_user, make_stock, auth_headers
    ):
        investor = make_user(role="investor")
        stock = make_stock()

        resp = client.post(
            f"/api/alerts/{stock['ticker']}",
            json={"target_price": 10.0, "condition": "sideways"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 400

    def test_create_alert_invalid_price_returns_400(
        self, client, make_user, make_stock, auth_headers
    ):
        investor = make_user(role="investor")
        stock = make_stock()

        resp = client.post(
            f"/api/alerts/{stock['ticker']}",
            json={"target_price": -5, "condition": "above"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 400

    def test_get_all_alerts_lists_created_alert(
        self, client, make_user, make_stock, auth_headers
    ):
        investor = make_user(role="investor")
        stock = make_stock()
        client.post(
            f"/api/alerts/{stock['ticker']}",
            json={"target_price": 50.0, "condition": "below"},
            headers=auth_headers(investor),
        )

        resp = client.get("/api/alerts", headers=auth_headers(investor))
        assert resp.status_code == 200, resp.text
        tickers = [row["ticker"] for row in resp.json()]
        assert stock["ticker"] in tickers

    def test_update_alert_success(self, client, make_user, make_stock, auth_headers):
        investor = make_user(role="investor")
        stock = make_stock()
        alert = client.post(
            f"/api/alerts/{stock['ticker']}",
            json={"target_price": 50.0, "condition": "below"},
            headers=auth_headers(investor),
        ).json()

        resp = client.patch(
            f"/api/alerts/{alert['id']}",
            json={"new_price": 75.0, "alert_type": "above"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["target_price"] == 75.0
        assert body["condition"] == "above"

    def test_update_alert_not_found_returns_404(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")

        resp = client.patch(
            "/api/alerts/00000000-0000-0000-0000-000000000000",
            json={"new_price": 10.0, "alert_type": "above"},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 404

    def test_delete_alert_success_and_404_for_missing(
        self, client, make_user, make_stock, auth_headers, db
    ):
        investor = make_user(role="investor")
        stock = make_stock()
        alert = client.post(
            f"/api/alerts/{stock['ticker']}",
            json={"target_price": 50.0, "condition": "below"},
            headers=auth_headers(investor),
        ).json()

        resp = client.delete(
            f"/api/alerts/{alert['id']}", headers=auth_headers(investor)
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["success"] is True

        row = db.table("price_alerts").select("*").eq("id", alert["id"]).execute()
        assert not row.data

        again = client.delete(
            f"/api/alerts/{alert['id']}", headers=auth_headers(investor)
        )
        assert again.status_code == 404
