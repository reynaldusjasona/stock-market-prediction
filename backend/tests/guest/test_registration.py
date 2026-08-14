from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.auth_service import validateInputs


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "email", "password", "expected_error"),
    [
        ("", "guest@example.com", "testing123", "Name is required"),
        ("Guest User", "not-an-email", "testing123", "Invalid email format"),
        (
            "Guest User",
            "guest@example.com",
            "short",
            "Password must be at least 8 characters",
        ),
    ],
)
async def test_validate_inputs_rejects_invalid_registration_data(
    name, email, password, expected_error
):
    result = await validateInputs(name, email, password)

    assert result == {"valid": False, "error": expected_error}


@pytest.mark.asyncio
async def test_validate_inputs_accepts_valid_registration_data():
    result = await validateInputs(
        "Guest User", "guest@example.com", "testing123"
    )

    assert result == {"valid": True}


def test_register_creates_investor_without_storing_plaintext_password(client):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.insert.return_value = query
    query.execute.side_effect = [
        MagicMock(data=[]),
        MagicMock(data=[{"id": "new-user-id"}]),
    ]

    supabase = MagicMock()
    supabase.table.return_value = query

    with patch("app.routers.auth.supabase", supabase), patch(
        "app.routers.auth.validateInputs",
        new=AsyncMock(return_value={"valid": True}),
    ), patch(
        "app.routers.auth.hashPassword", return_value="hashed-password"
    ), patch(
        "app.routers.auth.savePreferences", new=AsyncMock(return_value={})
    ) as save_preferences, patch(
        "app.routers.auth.createAndSendVerificationEmail", new=AsyncMock()
    ) as send_verification:
        response = client.post(
            "/api/auth/register",
            json={
                "name": "Guest User",
                "email": "guest@example.com",
                "password": "testing123",
                "role": "investor",
                "sectors": ["Technology"],
                "level": "moderate",
            },
        )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "message": "Registration successful",
        "user_id": "new-user-id",
    }

    inserted = query.insert.call_args.args[0]
    assert inserted["name"] == "Guest User"
    assert inserted["email"] == "guest@example.com"
    assert inserted["role"] == "investor"
    assert inserted["status"] == "active"
    assert inserted["password_hash"] == "hashed-password"
    assert "password" not in inserted
    save_preferences.assert_awaited_once_with(
        "new-user-id", ["Technology"], "moderate"
    )
    send_verification.assert_awaited_once_with(
        "new-user-id", "Guest User", "guest@example.com"
    )


def test_register_rejects_duplicate_email(client):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.execute.return_value = MagicMock(data=[{"id": "existing-user"}])
    supabase = MagicMock()
    supabase.table.return_value = query

    with patch("app.routers.auth.supabase", supabase), patch(
        "app.routers.auth.validateInputs",
        new=AsyncMock(return_value={"valid": True}),
    ):
        response = client.post(
            "/api/auth/register",
            json={
                "name": "Guest User",
                "email": "existing@example.com",
                "password": "testing123",
                "role": "investor",
            },
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"
    query.insert.assert_not_called()


def test_register_rejects_role_outside_public_roles(client):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.execute.return_value = MagicMock(data=[])
    supabase = MagicMock()
    supabase.table.return_value = query

    with patch("app.routers.auth.supabase", supabase), patch(
        "app.routers.auth.validateInputs",
        new=AsyncMock(return_value={"valid": True}),
    ):
        response = client.post(
            "/api/auth/register",
            json={
                "name": "Guest User",
                "email": "guest@example.com",
                "password": "testing123",
                "role": "admin",
            },
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Role must be 'investor' or 'trader'"
