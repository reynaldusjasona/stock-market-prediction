from datetime import datetime, timezone


def _unique_email(prefix: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    return f"{prefix}_{stamp}@integration-test.local"


def _cleanup_user_by_email(db, email: str) -> None:
    result = db.table("users").select("id").eq("email", email).execute()
    for row in result.data or []:
        user_id = row["id"]
        # Child-first cleanup mirrors the existing investor integration suite.
        db.table("stock_inquiries").delete().eq(
            "investor_id", user_id
        ).execute()
        db.table("stock_inquiries").delete().eq("trader_id", user_id).execute()
        db.table("trader_clients").delete().eq(
            "investor_id", user_id
        ).execute()
        db.table("trader_clients").delete().eq("trader_id", user_id).execute()
        for table in (
            "subscriptions",
            "notifications",
            "price_alerts",
            "portfolio",
            "watchlist",
            "feedback",
        ):
            db.table(table).delete().eq("user_id", user_id).execute()
        db.table("activity_logs").delete().eq("user_id", user_id).execute()
        db.table("activity_logs").delete().eq("target_id", user_id).execute()
        db.table("users").delete().eq("id", user_id).execute()


def test_complete_registration_and_email_verification_flow(client, db):
    email = _unique_email("guest_register")
    try:
        response = client.post(
            "/api/auth/register",
            json={
                "name": "Guest Integration",
                "email": email,
                "password": "testing123",
                "role": "investor",
                "sectors": ["Technology"],
                "level": "moderate",
            },
        )
        assert response.status_code == 200, response.text
        user_id = response.json()["user_id"]

        rows = (
            db.table("users")
            .select(
                "id, name, email, password_hash, role, status, "
                "risk_tolerance, sector_preferences, is_verified, "
                "verification_token"
            )
            .eq("id", user_id)
            .execute()
            .data
        )
        assert len(rows) == 1
        user = rows[0]
        assert user["name"] == "Guest Integration"
        assert user["email"] == email
        assert user["role"] == "investor"
        assert user["status"] == "active"
        assert user["risk_tolerance"] == "moderate"
        assert user["sector_preferences"] == ["Technology"]
        assert user["password_hash"] != "testing123"
        assert user["is_verified"] is False
        assert user["verification_token"]

        verify = client.get(
            f"/api/auth/verify/{user['verification_token']}"
        )
        assert verify.status_code == 200, verify.text

        verified_user = (
            db.table("users")
            .select("is_verified, verification_token")
            .eq("id", user_id)
            .execute()
            .data[0]
        )
        assert verified_user["is_verified"] is True
        assert verified_user["verification_token"] is None
    finally:
        _cleanup_user_by_email(db, email)


def test_duplicate_registration_is_rejected_without_second_record(client, db):
    email = _unique_email("guest_duplicate")
    payload = {
        "name": "Duplicate Guest",
        "email": email,
        "password": "testing123",
        "role": "investor",
    }
    try:
        first = client.post("/api/auth/register", json=payload)
        second = client.post("/api/auth/register", json=payload)

        assert first.status_code == 200, first.text
        assert second.status_code == 400
        assert second.json()["detail"] == "Email already registered"

        records = db.table("users").select("id").eq("email", email).execute()
        assert len(records.data or []) == 1
    finally:
        _cleanup_user_by_email(db, email)


def test_registration_rejects_invalid_email(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Guest User",
            "email": "invalid-email",
            "password": "testing123",
            "role": "investor",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid email format"


def test_registration_rejects_short_password(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Guest User",
            "email": _unique_email("guest_short_password"),
            "password": "short",
            "role": "investor",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Password must be at least 8 characters"
