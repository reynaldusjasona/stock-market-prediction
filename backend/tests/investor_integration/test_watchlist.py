class TestWatchlist:
    def test_add_to_watchlist_success(self, client, make_user, make_stock, auth_headers, db):
        investor = make_user(role="investor")
        stock = make_stock()

        resp = client.post(
            f"/api/watchlist/{stock['ticker']}", headers=auth_headers(investor)
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["ticker"] == stock["ticker"]

        row = db.table("watchlist").select("*").eq(
            "user_id", investor["id"]
        ).eq("ticker", stock["ticker"]).execute()
        assert row.data

    def test_add_duplicate_ticker_returns_409(
        self, client, make_user, make_stock, auth_headers
    ):
        investor = make_user(role="investor")
        stock = make_stock()

        first = client.post(
            f"/api/watchlist/{stock['ticker']}", headers=auth_headers(investor)
        )
        assert first.status_code == 201

        second = client.post(
            f"/api/watchlist/{stock['ticker']}", headers=auth_headers(investor)
        )
        assert second.status_code == 409

    def test_list_watchlist_includes_added_ticker(
        self, client, make_user, make_stock, auth_headers
    ):
        investor = make_user(role="investor")
        stock = make_stock()
        client.post(f"/api/watchlist/{stock['ticker']}", headers=auth_headers(investor))

        resp = client.get("/api/watchlist", headers=auth_headers(investor))
        assert resp.status_code == 200, resp.text
        tickers = [row["ticker"] for row in resp.json()]
        assert stock["ticker"] in tickers

    def test_remove_from_watchlist_success(
        self, client, make_user, make_stock, auth_headers, db
    ):
        investor = make_user(role="investor")
        stock = make_stock()
        client.post(f"/api/watchlist/{stock['ticker']}", headers=auth_headers(investor))

        resp = client.delete(
            f"/api/watchlist/{stock['ticker']}", headers=auth_headers(investor)
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["success"] is True

        row = db.table("watchlist").select("*").eq(
            "user_id", investor["id"]
        ).eq("ticker", stock["ticker"]).execute()
        assert not row.data

    def test_remove_from_watchlist_returns_404_when_not_present(
        self, client, make_user, make_stock, auth_headers
    ):
        investor = make_user(role="investor")
        stock = make_stock()

        resp = client.delete(
            f"/api/watchlist/{stock['ticker']}", headers=auth_headers(investor)
        )
        assert resp.status_code == 404
