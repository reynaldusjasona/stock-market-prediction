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


def unique_email(prefix: str = "user") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}@integration-test.local"


def _insert_user(**overrides) -> dict:
    data = {
        "name": "Integration Test User",
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
    supabase.table("activity_logs").delete().eq("user_id", user_id).execute()
    supabase.table("activity_logs").delete().eq("target_id", user_id).execute()
    supabase.table("feedback").delete().eq("user_id", user_id).execute()
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
