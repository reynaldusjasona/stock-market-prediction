"""
Integration tests for Trader signals and endorsements (T-5 to T-7, T-9).
Run against a real Supabase test database.
"""


class TestViewSignals:
    """T-6-INT: GET /trader/signals returns real signal data."""

    def test_signals_returned_for_assigned_trader(
        self, client, make_user, make_investor, auth_headers, create_signal
    ):
        trader = make_user()
        investor = make_investor()
        signal = create_signal(trader["id"], investor["id"], ticker="AAPL")
        headers = auth_headers(trader)

        resp = client.get("/api/trader/signals", headers=headers)
        assert resp.status_code == 200
        signals = resp.json()["signals"]
        assert any(s["id"] == signal["id"] for s in signals)

    def test_signals_not_visible_to_other_trader(
        self, client, make_user, make_investor, auth_headers, create_signal
    ):
        trader_a = make_user()
        trader_b = make_user()
        investor = make_investor()
        create_signal(trader_a["id"], investor["id"])

        resp = client.get(
            "/api/trader/signals", headers=auth_headers(trader_b)
        )
        assert resp.status_code == 200
        assert resp.json()["signals"] == []

    def test_ticker_filter_works(
        self, client, make_user, make_investor, auth_headers, create_signal
    ):
        trader = make_user()
        investor = make_investor()
        create_signal(trader["id"], investor["id"], ticker="AAPL")
        create_signal(trader["id"], investor["id"], ticker="MSFT")

        resp = client.get(
            "/api/trader/signals?ticker=AAPL",
            headers=auth_headers(trader),
        )
        assert resp.status_code == 200
        tickers = [s["ticker"] for s in resp.json()["signals"]]
        assert all(t == "AAPL" for t in tickers)


class TestEndorseSignal:
    """T-7-INT: POST /trader/signals/endorse persists verdict to DB."""

    def test_agree_endorsement_persisted(
        self,
        client,
        make_user,
        make_investor,
        auth_headers,
        create_signal,
        db,
    ):
        trader = make_user()
        investor = make_investor()
        signal = create_signal(trader["id"], investor["id"])
        headers = auth_headers(trader)

        resp = client.post(
            "/api/trader/signals/endorse",
            json={
                "signal_id": signal["id"],
                "endorsement": "agree",
                "notes": "Confirmed uptrend",
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["endorsement"]["verdict"] == "agree"

        row = (
            db.table("trader_signal")
            .select("verdict, note, endorsed_at")
            .eq("id", signal["id"])
            .execute()
        )
        assert row.data[0]["verdict"] == "agree"
        assert row.data[0]["note"] == "Confirmed uptrend"
        assert row.data[0]["endorsed_at"] is not None

    def test_disagree_endorsement_persisted(
        self,
        client,
        make_user,
        make_investor,
        auth_headers,
        create_signal,
        db,
    ):
        trader = make_user()
        investor = make_investor()
        signal = create_signal(trader["id"], investor["id"])
        headers = auth_headers(trader)

        resp = client.post(
            "/api/trader/signals/endorse",
            json={
                "signal_id": signal["id"],
                "endorsement": "disagree",
                "notes": "Weak fundamentals",
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["endorsement"]["verdict"] == "disagree"

    def test_invalid_endorsement_rejected(
        self, client, make_user, make_investor, auth_headers, create_signal
    ):
        trader = make_user()
        investor = make_investor()
        signal = create_signal(trader["id"], investor["id"])

        resp = client.post(
            "/api/trader/signals/endorse",
            json={"signal_id": signal["id"], "endorsement": "maybe"},
            headers=auth_headers(trader),
        )
        assert resp.status_code == 400

    def test_wrong_trader_cannot_endorse(
        self, client, make_user, make_investor, auth_headers, create_signal
    ):
        trader_a = make_user()
        trader_b = make_user()
        investor = make_investor()
        signal = create_signal(trader_a["id"], investor["id"])

        resp = client.post(
            "/api/trader/signals/endorse",
            json={"signal_id": signal["id"], "endorsement": "agree"},
            headers=auth_headers(trader_b),
        )
        assert resp.status_code == 404


class TestEndorsementHistory:
    """T-9-INT: GET /trader/endorsements returns only reviewed signals."""

    def test_only_endorsed_signals_returned(
        self,
        client,
        make_user,
        make_investor,
        auth_headers,
        create_signal,
    ):
        trader = make_user()
        investor = make_investor()
        headers = auth_headers(trader)

        # Create two signals — endorse only one
        sig_a = create_signal(trader["id"], investor["id"], ticker="AAPL")
        create_signal(trader["id"], investor["id"], ticker="MSFT")

        client.post(
            "/api/trader/signals/endorse",
            json={"signal_id": sig_a["id"], "endorsement": "agree"},
            headers=headers,
        )

        resp = client.get("/api/trader/endorsements", headers=headers)
        assert resp.status_code == 200
        endorsements = resp.json()["endorsements"]
        assert len(endorsements) == 1
        assert endorsements[0]["ticker"] == "AAPL"
        assert endorsements[0]["verdict"] == "agree"
