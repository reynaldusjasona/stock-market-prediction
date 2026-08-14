import pytest
from fastapi.testclient import TestClient

from app.core.database import supabase
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db():
    return supabase
