class TestPortfolio:
    def test_add_holding_creates_new_row(
        self, client, make_user, make_stock, auth_headers, db
    ):
        investor = make_user(role="investor")
        stock = make_stock()

        resp = client.post(
            "/api/portfolio",
            json={"ticker": stock["ticker"], "shares": 10, "average_buy_price": 100.0},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["shares"] == 10
        assert body["average_buy_price"] == 100.0

        row = db.table("portfolio").select("*").eq(
            "user_id", investor["id"]
        ).eq("ticker", stock["ticker"]).execute().data[0]
        assert row["shares"] == 10

    def test_add_holding_again_averages_price(
        self, client, make_user, make_stock, auth_headers
    ):
        investor = make_user(role="investor")
        stock = make_stock()

        client.post(
            "/api/portfolio",
            json={"ticker": stock["ticker"], "shares": 10, "average_buy_price": 100.0},
            headers=auth_headers(investor),
        )
        resp = client.post(
            "/api/portfolio",
            json={"ticker": stock["ticker"], "shares": 10, "average_buy_price": 200.0},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["shares"] == 20
        assert body["average_buy_price"] == 150.0

    def test_add_holding_invalid_shares_returns_400(
        self, client, make_user, make_stock, auth_headers
    ):
        investor = make_user(role="investor")
        stock = make_stock()

        resp = client.post(
            "/api/portfolio",
            json={"ticker": stock["ticker"], "shares": 0, "average_buy_price": 100.0},
            headers=auth_headers(investor),
        )
        assert resp.status_code == 400

    def test_get_holding_detail_returns_404_when_missing(
        self, client, make_user, auth_headers
    ):
        investor = make_user(role="investor")

        resp = client.get("/api/portfolio/NOPE", headers=auth_headers(investor))
        assert resp.status_code == 404

    def test_remove_holding_success_and_404(
        self, client, make_user, make_stock, auth_headers, db
    ):
        investor = make_user(role="investor")
        stock = make_stock()
        client.post(
            "/api/portfolio",
            json={"ticker": stock["ticker"], "shares": 5, "average_buy_price": 50.0},
            headers=auth_headers(investor),
        )

        resp = client.delete(
            f"/api/portfolio/{stock['ticker']}", headers=auth_headers(investor)
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["success"] is True

        row = db.table("portfolio").select("*").eq(
            "user_id", investor["id"]
        ).eq("ticker", stock["ticker"]).execute()
        assert not row.data

        again = client.delete(
            f"/api/portfolio/{stock['ticker']}", headers=auth_headers(investor)
        )
        assert again.status_code == 404
