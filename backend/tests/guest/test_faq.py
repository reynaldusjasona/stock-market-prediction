from unittest.mock import AsyncMock, patch


def test_faq_returns_visible_records_in_service_order(client):
    rows = [
        {
            "id": "faq-1",
            "question": "What is StockWise AI?",
            "answer": "A stock-analysis platform.",
            "is_visible": True,
            "display_order": 1,
        },
        {
            "id": "faq-hidden",
            "question": "Draft question",
            "answer": "Draft answer",
            "is_visible": False,
            "display_order": 2,
        },
        {
            "id": "faq-2",
            "question": "Is registration required?",
            "answer": "Only for personalised features.",
            "is_visible": True,
            "display_order": 3,
        },
    ]

    with patch(
        "app.services.faq_service.getFAQs",
        new=AsyncMock(return_value=rows),
    ):
        response = client.get("/api/faq")

    assert response.status_code == 200, response.text
    faqs = response.json()["faqs"]
    assert [faq["id"] for faq in faqs] == ["faq-1", "faq-2"]
    assert all("question" in faq and "answer" in faq for faq in faqs)


def test_faq_missing_visibility_flag_defaults_to_visible(client):
    row = {"id": "faq-1", "question": "Question", "answer": "Answer"}

    with patch(
        "app.services.faq_service.getFAQs",
        new=AsyncMock(return_value=[row]),
    ):
        response = client.get("/api/faq")

    assert response.status_code == 200
    assert response.json() == {"faqs": [row]}


def test_faq_empty_response_does_not_fail(client):
    with patch(
        "app.services.faq_service.getFAQs",
        new=AsyncMock(return_value=[]),
    ):
        response = client.get("/api/faq")

    assert response.status_code == 200
    assert response.json() == {"faqs": []}
