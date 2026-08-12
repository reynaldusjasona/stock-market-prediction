"""
Integration tests for Trader account management (T-12, T-13).
Run against a real Supabase test database.
"""


class TestViewTraderAccount:
    """T-12-INT: GET /auth/user/{id} returns trader-specific fields."""

    def test_trader_profile_includes_license_and_specialization(
        self, client, make_user, auth_headers
    ):
        trader = make_user(
            specialization="Equities",
            years_experience=5,
            bio="Senior analyst",
        )
        headers = auth_headers(trader)

        resp = client.get(
            f"/api/auth/user/{trader['id']}", headers=headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["license_number"] == trader["license_number"]
        assert data["specialization"] == "Equities"
        assert data["years_experience"] == 5


class TestUpdateTraderAccount:
    """T-13-INT: PUT /auth/user/{id} updates trader fields in DB."""

    def test_update_specialization_and_bio(
        self, client, make_user, auth_headers, db
    ):
        trader = make_user(specialization="Equities")
        headers = auth_headers(trader)

        resp = client.put(
            f"/api/auth/user/{trader['id']}",
            json={
                "name": trader["name"],
                "specialization": "Derivatives",
                "bio": "Switched to derivatives",
                "years_experience": 8,
            },
            headers=headers,
        )
        assert resp.status_code == 200

        row = (
            db.table("users")
            .select("specialization, bio, years_experience")
            .eq("id", trader["id"])
            .execute()
        )
        assert row.data[0]["specialization"] == "Derivatives"
        assert row.data[0]["bio"] == "Switched to derivatives"
        assert row.data[0]["years_experience"] == 8

    def test_update_does_not_overwrite_license(
        self, client, make_user, auth_headers, db
    ):
        """License number is immutable after registration."""
        trader = make_user()
        headers = auth_headers(trader)
        original_license = trader["license_number"]

        client.put(
            f"/api/auth/user/{trader['id']}",
            json={"name": "Updated Name"},
            headers=headers,
        )

        row = (
            db.table("users")
            .select("license_number")
            .eq("id", trader["id"])
            .execute()
        )
        assert row.data[0]["license_number"] == original_license
