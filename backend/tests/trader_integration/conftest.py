import os
import uuid

import pytest
from dotenv import load_dotenv

_ENV_FILE = os.getenv("ENV_FILE", ".env.test")
load_dotenv(_ENV_FILE, override=True)

if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_KEY"):
    pytest.exit(
        f"SUPABASE_URL / SUPABASE_KEY not set after loading {_ENV_FILE}. "
        f"These integration tests require a real (disposable, test-only) "
        f"Supabase project — see tests/admin_integration/README.md.",
        returncode=1,
    )

from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import supabase  # noqa: E402
from app.core.security import createAccessToken, hashPassword  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def unique_email(prefix: str = "trader") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}@integration-test.local"


def _insert_user(**overrides) -> dict:
    data = {
        "name": "Integration Test Trader",
        "email": unique_email(),
        "password_hash": hashPassword("testing123"),
        "role": "trader",
        "status": "active",
        "is_verified": True,
        "trader_status": "approved",
        "license_number": f"LIC-{uuid.uuid4().hex[:8]}",
    }
    data.update(overrides)
    result = supabase.table("users").insert(data).execute()
    assert result.data, f"failed to insert test user: {data}"
    return result.data[0]


def _delete_user(user_id: str) -> None:
    supabase.table("trader_signal").delete().eq(
        "trader_id", user_id
    ).execute()
    supabase.table("trader_clients").delete().eq(
        "trader_id", user_id
    ).execute()
    supabase.table("stock_inquiries").delete().eq(
        "trader_id", user_id
    ).execute()
    supabase.table("activity_logs").delete().eq(
        "user_id", user_id
    ).execute()
    supabase.table("activity_logs").delete().eq(
        "target_id", user_id
    ).execute()
    supabase.table("notifications").delete().eq(
        "user_id", user_id
    ).execute()
    supabase.table("users").delete().eq("id", user_id).execute()


@pytest.fixture
def make_user():
    created_ids = []

    def _make(**overrides):
        user = _insert_user(**overrides)
        created_ids.append(user["id"])
        return user

    yield _make

    for uid in created_ids:
        _delete_user(uid)


@pytest.fixture
def make_investor(make_user):
    """Create an investor user for engagement/inquiry tests."""

    def _make(**overrides):
        defaults = {
            "name": "Test Investor",
            "email": unique_email("investor"),
            "role": "investor",
            "trader_status": None,
            "license_number": None,
        }
        defaults.update(overrides)
        return make_user(**defaults)

    return _make


@pytest.fixture
def auth_headers():
    def _headers(user: dict) -> dict:
        token = createAccessToken(
            {"sub": user["id"], "email": user["email"], "role": user["role"]}
        )
        return {"Authorization": f"Bearer {token}"}

    return _headers


@pytest.fixture
def db():
    return supabase


@pytest.fixture
def link_client(db):
    """Create a trader_clients engagement row."""
    created = []

    def _link(trader_id: str, investor_id: str):
        result = (
            db.table("trader_clients")
            .insert(
                {
                    "trader_id": trader_id,
                    "investor_id": investor_id,
                    "status": "active",
                }
            )
            .execute()
        )
        if result.data:
            created.append(result.data[0]["id"])
        return result.data[0] if result.data else None

    yield _link

    for cid in created:
        db.table("trader_clients").delete().eq("id", cid).execute()


@pytest.fixture
def create_signal(db):
    """Insert a trader_signal row for review tests."""
    created = []

    def _create(trader_id: str, investor_id: str, **overrides):
        data = {
            "trader_id": trader_id,
            "investor_id": investor_id,
            "ticker": "AAPL",
            "signal": "Buy",
            "confidence_score": 72.5,
            "reasoning": "Test signal",
        }
        data.update(overrides)
        result = db.table("trader_signal").insert(data).execute()
        if result.data:
            created.append(result.data[0]["id"])
        return result.data[0] if result.data else None

    yield _create

    for sid in created:
        db.table("trader_signal").delete().eq("id", sid).execute()


@pytest.fixture
def create_inquiry(db):
    """Insert a stock_inquiries row."""
    created = []

    def _create(trader_id: str, investor_id: str, **overrides):
        data = {
            "trader_id": trader_id,
            "investor_id": investor_id,
            "ticker": "TSLA",
            "message": "Should I hold?",
            "status": "pending",
        }
        data.update(overrides)
        result = db.table("stock_inquiries").insert(data).execute()
        if result.data:
            created.append(result.data[0]["id"])
        return result.data[0] if result.data else None

    yield _create

    for iid in created:
        db.table("stock_inquiries").delete().eq("id", iid).execute()
