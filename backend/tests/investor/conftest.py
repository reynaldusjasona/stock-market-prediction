from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# app.core.database calls load_dotenv() + create_client(...) at module import
# time, and create_client() validates the API key eagerly (it raises
# "Invalid API key" on a non-JWT placeholder) - so unlike a plain lazy client,
# we can't just feed it dummy creds. We let load_dotenv() pick up the real
# backend/.env credentials already used by this project instead.
#
# Whatever app.core.database.supabase resolves to at this first import is
# cached by Python for the rest of the pytest process - no fixture can change
# that. tests/admin/conftest.py's bug was forcing that one-time value to be a
# MagicMock (via a bare module-level `with patch("supabase.create_client", ...)`
# block wrapping its imports), which then leaked into any suite that ran later
# in the same session and read app.core.database.supabase directly. We avoid
# that by letting the real client be constructed normally here; the per-test
# mock_supabase fixture below patches it out (and restores it) for every
# investor test via a proper yield-scoped `with`, so nothing ever depends on
# real network access and nothing leaks past this file's tests.
from app.main import app  # noqa: E402
from app.core.security import get_current_user  # noqa: E402

MOCK_INVESTOR = {
    "id": "investor1",
    "sub": "investor1",
    "name": "Jamie Osei",
    "email": "jamie.osei@gmail.com",
    "role": "investor",
}


def _mock_get_current_user():
    return MOCK_INVESTOR


INVESTOR_HEADERS = {"Authorization": "Bearer test"}


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
def mock_current_user():
    # app.dependency_overrides is a plain dict on the shared, session-wide app
    # singleton - same story as app.core.database.supabase above. tests/admin/
    # conftest.py sets this once at import time and never restores it, which
    # works only because admin/ is the only suite that touches it. Setting our
    # own override the same way would let whichever suite's conftest imports
    # last "win" for the rest of the session (investor imports after admin
    # alphabetically, so it would silently break every admin test's role
    # check). Save/restore per-test instead so it never outlives this suite.
    previous = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = _mock_get_current_user
    yield
    if previous is not None:
        app.dependency_overrides[get_current_user] = previous
    else:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(autouse=True)
def mock_supabase():
    fake_query = FakeSupabaseQuery()

    def set_result(data=None, count=None):
        fake_query._result = FakeSupabaseResult(data=data, count=count)

    fake_query.set_result = set_result
    fake_query.set_result(data=[])  # empty by default; tests set what they need

    mock_client = MagicMock()
    mock_client.table.return_value = fake_query

    # Patched and torn down per-test via this fixture's yield - the mock never
    # outlives the test, so it can't leak into a later-running suite.
    with patch("app.core.database.supabase", mock_client), patch(
        "app.services.auth_service.supabase", mock_client
    ), patch("app.routers.auth.supabase", mock_client):
        yield fake_query


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
