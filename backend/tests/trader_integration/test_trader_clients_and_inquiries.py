"""
Integration tests for Trader clients and inquiries (T-8, T-10, T-11).
Run against a real Supabase test database.
"""


class TestViewClients:
    """T-8-INT: GET /trader/clients returns engaged investors."""

    def test_linked_client_appears(
        self,
        client,
        make_user,
        make_investor,
        auth_headers,
        link_client,
    ):
        trader = make_user()
        investor = make_investor()
        link_client(trader["id"], investor["id"])

        resp = client.get(
            "/api/trader/clients", headers=auth_headers(trader)
        )
        assert resp.status_code == 200
        clients = resp.json()["clients"]
        assert len(clients) == 1
        assert clients[0]["email"] == investor["email"]

    def test_no_clients_returns_empty_list(
        self, client, make_user, auth_headers
    ):
        trader = make_user()

        resp = client.get(
            "/api/trader/clients", headers=auth_headers(trader)
        )
        assert resp.status_code == 200
        assert resp.json()["clients"] == []

    def test_other_traders_clients_not_visible(
        self,
        client,
        make_user,
        make_investor,
        auth_headers,
        link_client,
    ):
        trader_a = make_user()
        trader_b = make_user()
        investor = make_investor()
        link_client(trader_a["id"], investor["id"])

        resp = client.get(
            "/api/trader/clients", headers=auth_headers(trader_b)
        )
        assert resp.status_code == 200
        assert resp.json()["clients"] == []


class TestViewStockInquiries:
    """T-10-INT: GET /trader/stock-inquiries returns investor questions."""

    def test_inquiry_visible_to_assigned_trader(
        self,
        client,
        make_user,
        make_investor,
        auth_headers,
        create_inquiry,
    ):
        trader = make_user()
        investor = make_investor()
        inquiry = create_inquiry(trader["id"], investor["id"])

        resp = client.get(
            "/api/trader/stock-inquiries", headers=auth_headers(trader)
        )
        assert resp.status_code == 200
        inquiries = resp.json()["inquiries"]
        assert any(i["id"] == inquiry["id"] for i in inquiries)

    def test_inquiry_not_visible_to_other_trader(
        self,
        client,
        make_user,
        make_investor,
        auth_headers,
        create_inquiry,
    ):
        trader_a = make_user()
        trader_b = make_user()
        investor = make_investor()
        create_inquiry(trader_a["id"], investor["id"])

        resp = client.get(
            "/api/trader/stock-inquiries", headers=auth_headers(trader_b)
        )
        assert resp.status_code == 200
        assert resp.json()["inquiries"] == []


class TestRespondToInquiry:
    """T-11-INT: PATCH /trader/stock-inquiries/{id} saves response
    and creates a notification for the investor."""

    def test_response_persisted_and_status_changed(
        self,
        client,
        make_user,
        make_investor,
        auth_headers,
        create_inquiry,
        db,
    ):
        trader = make_user()
        investor = make_investor()
        inquiry = create_inquiry(trader["id"], investor["id"])
        headers = auth_headers(trader)

        resp = client.patch(
            f"/api/trader/stock-inquiries/{inquiry['id']}",
            json={"response": "Hold until after earnings"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["inquiry"]["status"] == "answered"

        row = (
            db.table("stock_inquiries")
            .select("response, status, responded_at")
            .eq("id", inquiry["id"])
            .execute()
        )
        assert row.data[0]["response"] == "Hold until after earnings"
        assert row.data[0]["status"] == "answered"
        assert row.data[0]["responded_at"] is not None

    def test_notification_created_for_investor(
        self,
        client,
        make_user,
        make_investor,
        auth_headers,
        create_inquiry,
        db,
    ):
        trader = make_user()
        investor = make_investor()
        inquiry = create_inquiry(trader["id"], investor["id"])

        client.patch(
            f"/api/trader/stock-inquiries/{inquiry['id']}",
            json={"response": "Sell before close"},
            headers=auth_headers(trader),
        )

        notifs = (
            db.table("notifications")
            .select("user_id, title, type")
            .eq("user_id", investor["id"])
            .execute()
        )
        assert any(
            "responded" in n["title"].lower() for n in notifs.data
        )

        # cleanup
        db.table("notifications").delete().eq(
            "user_id", investor["id"]
        ).execute()

    def test_wrong_trader_cannot_respond(
        self,
        client,
        make_user,
        make_investor,
        auth_headers,
        create_inquiry,
    ):
        trader_a = make_user()
        trader_b = make_user()
        investor = make_investor()
        inquiry = create_inquiry(trader_a["id"], investor["id"])

        resp = client.patch(
            f"/api/trader/stock-inquiries/{inquiry['id']}",
            json={"response": "Unauthorized response"},
            headers=auth_headers(trader_b),
        )
        assert resp.status_code == 404
