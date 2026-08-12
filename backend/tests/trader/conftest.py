import os
from unittest.mock import MagicMock, patch

os.environ.setdefault("SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "placeholder-key")

with patch("supabase.create_client", return_value=MagicMock()):
    import pytest  # noqa: E402
    from fastapi.testclient import TestClient  # noqa: E402
    from app.main import app  # noqa: E402
    from app.core.security import get_current_user  # noqa: E402
    from app.routers.trader import require_approved_trader  # noqa: E402

MOCK_TRADER = {
    "id": "trader1",
    "sub": "trader1",
    "name": "Test Trader",
    "email": "trader@test.com",
    "role": "trader",
}


def _mock_get_current_user():
    return MOCK_TRADER


def _mock_require_approved_trader():
    return MOCK_TRADER


app.dependency_overrides[get_current_user] = _mock_get_current_user
app.dependency_overrides[require_approved_trader] = _mock_require_approved_trader

TRADER_HEADERS = {"Authorization": "Bearer test"}


class FakeSupabaseResult:
    def __init__(self, data=None, count=None):
        self.data = data if data is not None else []
        self.count = count if count is not None else len(self.data)


class FakeSupabaseQuery:
    def __init__(self, result=None):
        self._result = result if result is not None else FakeSupabaseResult()

    def __getattr__(self, name):
        def _chain(*args, **kwargs):
            return self

        return _chain

    def execute(self):
        return self._result


@pytest.fixture(autouse=True)
def mock_supabase():
    fake_query = FakeSupabaseQuery()

    def set_result(data=None, count=None):
        fake_query._result = FakeSupabaseResult(data=data, count=count)

    fake_query.set_result = set_result
    fake_query.set_result(data=[])

    mock_client = MagicMock()
    mock_client.table.return_value = fake_query

    with patch("app.core.database.supabase", mock_client), patch(
        "app.services.trader_service.supabase", mock_client
    ), patch("app.services.auth_service.supabase", mock_client), patch(
        "app.routers.auth.supabase", mock_client
    ), patch(
        "app.routers.trader.supabase", mock_client
    ):
        yield fake_query


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
