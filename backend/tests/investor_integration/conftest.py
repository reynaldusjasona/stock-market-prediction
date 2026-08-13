import os
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from dotenv import load_dotenv

_ENV_FILE = os.getenv("ENV_FILE", ".env.test")
load_dotenv(_ENV_FILE, override=True)

if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_KEY"):
    pytest.exit(
        f"SUPABASE_URL / SUPABASE_KEY not set after loading {_ENV_FILE}. "
        f"These integration tests require a real (disposable, test-only) "
        f"Supabase project - see tests/admin_integration/conftest.py for "
        f"the same pattern.",
        returncode=1,
    )

from fastapi.testclient import TestClient  # noqa: E402

import app.core.email as email  # noqa: E402
from app.core.database import supabase  # noqa: E402
from app.core.security import createAccessToken, hashPassword  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _no_network_email():
    # every send*Email() call in app.core.email routes through _send_sync,
    # which opens a real blocking smtplib.SMTP connection - patch it out so
    # OTP-issuing endpoints don't eat a real network round trip (or a 10s
    # timeout) per call. The OTP code itself is written to the DB before
    # the email is even attempted, so this has no effect on what's tested.
    with patch.object(email, "_send_sync", return_value=None):
        yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def unique_email(prefix: str = "investor") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}@integration-test.local"


def unique_ticker(prefix: str = "ZZ") -> str:
    return f"{prefix}{uuid.uuid4().hex[:4].upper()}"


def _insert_user(**overrides) -> dict:
    data = {
        "name": "Integration Test Investor",
        "email": unique_email(),
        "password_hash": hashPassword("testing123"),
        "role": "investor",
        "status": "active",
        "is_verified": True,
    }
    data.update(overrides)
    result = supabase.table("users").insert(data).execute()
    assert result.data, f"failed to insert test user: {data}"
    return result.data[0]


def _delete_user(user_id: str) -> None:
    # child rows referencing users.id must go before the users row itself,
    # in both FK directions where a table has two - see the investigation
    # that already flagged the admin_integration model_retrain_requests FK
    # violation caused by skipping this.
    supabase.table("stock_inquiries").delete().eq("investor_id", user_id).execute()
    supabase.table("stock_inquiries").delete().eq("trader_id", user_id).execute()
    supabase.table("trader_clients").delete().eq("investor_id", user_id).execute()
    supabase.table("trader_clients").delete().eq("trader_id", user_id).execute()
    supabase.table("subscriptions").delete().eq("user_id", user_id).execute()
    supabase.table("notifications").delete().eq("user_id", user_id).execute()
    supabase.table("price_alerts").delete().eq("user_id", user_id).execute()
    supabase.table("portfolio").delete().eq("user_id", user_id).execute()
    supabase.table("watchlist").delete().eq("user_id", user_id).execute()
    supabase.table("feedback").delete().eq("user_id", user_id).execute()
    supabase.table("activity_logs").delete().eq("user_id", user_id).execute()
    supabase.table("activity_logs").delete().eq("target_id", user_id).execute()
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


def _insert_stock(**overrides) -> dict:
    data = {
        "ticker": unique_ticker(),
        "company_name": "Integration Test Co",
        "exchange": "US",
    }
    data.update(overrides)
    result = supabase.table("stocks").insert(data).execute()
    assert result.data, f"failed to insert test stock: {data}"
    return result.data[0]


def _delete_stock(ticker: str) -> None:
    # same defensive-child-first ordering as _delete_user, in case the FK
    # from these tables to stocks.ticker isn't ON DELETE CASCADE
    supabase.table("price_alerts").delete().eq("ticker", ticker).execute()
    supabase.table("watchlist").delete().eq("ticker", ticker).execute()
    supabase.table("portfolio").delete().eq("ticker", ticker).execute()
    supabase.table("stock_inquiries").delete().eq("ticker", ticker).execute()
    supabase.table("stocks").delete().eq("ticker", ticker).execute()


@pytest.fixture
def make_stock():
    created_tickers = []

    def _make(**overrides):
        stock = _insert_stock(**overrides)
        created_tickers.append(stock["ticker"])
        return stock

    yield _make

    for ticker in created_tickers:
        _delete_stock(ticker)


@pytest.fixture
def grant_signal_access():
    # inserts straight into subscriptions - the child rows this creates are
    # already covered by make_user's teardown (_delete_user deletes
    # subscriptions by user_id), so no separate teardown is needed here.
    def _grant(user_id: str) -> dict:
        now = datetime.now(timezone.utc)
        result = (
            supabase.table("subscriptions")
            .insert({
                "user_id": user_id,
                "plan": "investor",
                "status": "active",
                "has_signal_access": True,
                "started_at": now.isoformat(),
                "expires_at": (now + timedelta(days=30)).isoformat(),
            })
            .execute()
        )
        return result.data[0]

    return _grant
