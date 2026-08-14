from unittest.mock import AsyncMock, patch


def test_public_feedback_maps_only_safe_testimonial_fields(client):
    rows = [
        {
            "id": "feedback-1",
            "subject": "Useful platform",
            "message": "The explanations are easy to follow.",
            "rating": 5,
            "user_id": "private-user-id",
            "users": {"name": "Amina"},
        }
    ]

    with patch(
        "app.services.feedback_service.getPublicApprovedFeedback",
        new=AsyncMock(return_value=rows),
    ) as get_feedback:
        response = client.get("/api/feedback/public")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "testimonials": [
            {
                "id": "feedback-1",
                "name": "Amina",
                "text": "The explanations are easy to follow.",
            }
        ]
    }
    assert "user_id" not in response.text
    get_feedback.assert_awaited_once_with()


def test_public_feedback_uses_fallback_name(client):
    rows = [{"id": "feedback-2", "message": "Helpful.", "users": None}]

    with patch(
        "app.services.feedback_service.getPublicApprovedFeedback",
        new=AsyncMock(return_value=rows),
    ):
        response = client.get("/api/feedback/public")

    assert response.status_code == 200
    assert response.json()["testimonials"][0]["name"] == (
        "StockWise AI investor"
    )


def test_public_feedback_empty_state_is_stable(client):
    with patch(
        "app.services.feedback_service.getPublicApprovedFeedback",
        new=AsyncMock(return_value=[]),
    ):
        response = client.get("/api/feedback/public")

    assert response.status_code == 200
    assert response.json() == {"testimonials": []}
