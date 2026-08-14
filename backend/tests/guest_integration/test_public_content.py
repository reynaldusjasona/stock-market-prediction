from app.services.admin_service import _apply_landing_defaults
from app.services.subscription_service import PLANS


def test_about_and_features_match_landing_page_database(client, db):
    response = client.get("/api/landing")

    assert response.status_code == 200, response.text
    rows = (
        db.table("landing_page_config")
        .select("content")
        .limit(1)
        .execute()
        .data
    )
    stored_content = rows[0].get("content", {}) if rows else {}
    expected = _apply_landing_defaults(
        stored_content if isinstance(stored_content, dict) else {}
    )

    body = response.json()
    assert body["about"] == expected["about"]
    assert body["features"] == expected["features"]


def test_public_feedback_returns_only_approved_records(client, db):
    response = client.get("/api/feedback/public")

    assert response.status_code == 200, response.text
    testimonials = response.json()["testimonials"]
    returned_ids = {item["id"] for item in testimonials}

    approved = (
        db.table("feedback")
        .select("id")
        .eq("status", "approved")
        .order("created_at", desc=True)
        .limit(9)
        .execute()
    )
    non_approved = (
        db.table("feedback")
        .select("id")
        .in_("status", ["pending", "rejected"])
        .execute()
    )

    assert returned_ids == {row["id"] for row in (approved.data or [])}
    assert returned_ids.isdisjoint(
        {row["id"] for row in (non_approved.data or [])}
    )
    assert all(set(item) == {"id", "name", "text"} for item in testimonials)


def test_subscription_plans_endpoint_matches_service_definition(client):
    response = client.get("/api/subscription/plans")

    assert response.status_code == 200, response.text
    body = response.json()
    returned_plans = body.get("plans", body) if isinstance(body, dict) else body
    assert returned_plans == PLANS
    assert any(plan["id"] == "investor" for plan in returned_plans)


def test_faq_endpoint_returns_visible_database_records_in_order(client, db):
    response = client.get("/api/faq")

    assert response.status_code == 200, response.text
    returned = response.json()["faqs"]
    database_rows = (
        db.table("faq").select("*").order("display_order").execute().data or []
    )
    expected = [row for row in database_rows if row.get("is_visible", True)]

    assert [row["id"] for row in returned] == [row["id"] for row in expected]
    assert all("question" in row and "answer" in row for row in returned)


def test_all_guest_content_endpoints_are_public(client):
    for path in (
        "/api/landing",
        "/api/feedback/public",
        "/api/subscription/plans",
        "/api/faq",
    ):
        response = client.get(path)
        assert response.status_code == 200, f"{path}: {response.text}"
