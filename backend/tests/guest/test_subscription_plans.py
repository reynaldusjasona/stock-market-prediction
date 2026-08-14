from app.services.subscription_service import PLANS


def test_public_plan_definition_contains_expected_investor_plan():
    investor_plan = next(plan for plan in PLANS if plan["id"] == "investor")

    assert investor_plan["name"] == "Investor Plan"
    assert investor_plan["price"] == 29.99
    assert investor_plan["currency"] == "usd"
    assert investor_plan["interval"] == "month"
    assert investor_plan["features"]


def test_no_admin_plan_is_exposed_to_guests():
    assert all(plan["id"] != "admin" for plan in PLANS)
