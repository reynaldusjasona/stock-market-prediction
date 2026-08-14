from app.services.admin_service import buildPublicLandingSections


def test_build_public_landing_sections_maps_about_content():
    content = {
        "about": {
            "subtitle": "Invest with greater clarity",
            "cards": [
                {"title": "Our purpose", "body": "Support new investors."},
                {"title": "Our approach", "body": "Explain each signal."},
            ],
        }
    }

    sections = buildPublicLandingSections(content)
    about = next(row for row in sections if row["section_key"] == "about")

    assert about["title"] == "About StockWise AI"
    assert about["subtitle"] == "Invest with greater clarity"
    assert "Our purpose: Support new investors." in about["content"]
    assert "Our approach: Explain each signal." in about["content"]
    assert about["is_visible"] is True


def test_build_public_landing_sections_maps_feature_items_in_order():
    content = {
        "features": {
            "subtitle": "What StockWise offers",
            "items": [
                {"title": "Predictions", "body": "View AI stock signals."},
                {"title": "Explanations", "body": "See influential factors."},
            ],
        }
    }

    sections = buildPublicLandingSections(content)
    features = next(
        row for row in sections if row["section_key"] == "features"
    )

    assert features["title"] == "Platform Features"
    assert features["subtitle"] == "What StockWise offers"
    assert features["content"] == (
        "Predictions: View AI stock signals. • "
        "Explanations: See influential factors."
    )


def test_empty_about_and_features_are_omitted_without_crashing():
    sections = buildPublicLandingSections({"about": {}, "features": {}})

    keys = [row["section_key"] for row in sections]
    assert "about" not in keys
    assert "features" not in keys
