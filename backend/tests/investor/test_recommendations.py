from unittest.mock import patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestRecommendations:
    def test_get_personalized_recommendations_success(self):
        mock_recs = [{"ticker": "AAPL", "signal": "Buy", "confidence_score": 82}]
        with patch(
            "app.routers.recommendations.getPersonalizedRecommendations",
            return_value=mock_recs,
        ):
            r = client.get("/api/recommendations/personalized")
        assert r.status_code == 200
        assert r.json()["personalized"] is True
        assert r.json()["count"] == 1

    def test_get_personalized_recommendations_respects_limit(self):
        with patch(
            "app.routers.recommendations.getPersonalizedRecommendations",
            return_value=[],
        ) as mock_get:
            r = client.get("/api/recommendations/personalized?limit=5")
        assert r.status_code == 200
        args = mock_get.call_args[0]
        assert args[1] == 5

    def test_get_recommendation_details_success(self):
        mock_details = {
            "ticker": "AAPL",
            "signal": "Buy",
            "confidence_score": 82,
            "reasoning": "Current price is 190.5 with 1.2% change today. "
            "Model confidence is 82%.",
        }
        with patch(
            "app.routers.predictions.svcGetRecommendationDetails",
            return_value=mock_details,
        ):
            r = client.get("/api/predictions/AAPL/details")
        assert r.status_code == 200
        assert r.json()["ticker"] == "AAPL"

    def test_get_recommendation_details_unavailable_returns_404(self):
        with patch(
            "app.routers.predictions.svcGetRecommendationDetails",
            side_effect=HTTPException(
                status_code=404,
                detail="Recommendation details unavailable for AAPL",
            ),
        ):
            r = client.get("/api/predictions/AAPL/details")
        assert r.status_code == 404
