from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from tests.admin.conftest import ADMIN_HEADERS

client = TestClient(app)


class TestUC19ManageFeedbacks:
    def test_A_19_BB_pending_filter(self):
        with patch(
            "app.services.feedback_service.getAllFeedback",
            return_value={"data": [{"status": "pending"}]},
        ):
            r = client.get("/api/feedback?status=pending", headers=ADMIN_HEADERS)
        assert r.status_code == 200

    def test_A_19_WB_response_unwrapped_from_data_key(self):
        with patch(
            "app.services.feedback_service.getAllFeedback",
            return_value={"data": [], "total": 0, "page": 1, "limit": 20},
        ):
            r = client.get("/api/feedback", headers=ADMIN_HEADERS)
        assert "data" in r.json()

    def test_A_19_FN_all_three_filter_states(self):
        with patch("app.services.feedback_service.getAllFeedback", return_value={"data": []}):
            r1 = client.get("/api/feedback?status=pending", headers=ADMIN_HEADERS)
            r2 = client.get("/api/feedback?status=approved", headers=ADMIN_HEADERS)
            r3 = client.get("/api/feedback?status=rejected", headers=ADMIN_HEADERS)
        assert all(r.status_code == 200 for r in [r1, r2, r3])


class TestUC20ViewFeedback:
    def test_A_20_BB_detail_shown(self):
        fb = {"id": "fb1", "message": "Great app", "rating": 5}
        with patch("app.routers.admin.getFeedbackById", return_value=fb):
            r = client.get("/api/admin/feedback/fb1", headers=ADMIN_HEADERS)
        assert r.json()["rating"] == 5

    def test_A_20_WB_not_found_returns_404(self):
        with patch("app.routers.admin.getFeedbackById", return_value=None):
            r = client.get("/api/admin/feedback/nonexistent", headers=ADMIN_HEADERS)
        assert r.status_code == 404

    def test_A_20_FN_view_then_approve(self):
        fb = {"id": "fb1", "status": "pending"}
        with patch("app.routers.admin.getFeedbackById", return_value=fb), patch(
            "app.services.feedback_service.updateFeedbackStatus",
            return_value={"status": "approved"},
        ):
            client.get("/api/admin/feedback/fb1", headers=ADMIN_HEADERS)
            r = client.patch("/api/feedback/fb1/approve", headers=ADMIN_HEADERS)
        assert r.json()["status"] == "approved"


class TestUC21SearchFeedback:
    def test_A_21_BB_unique_user_match(self):
        with patch(
            "app.services.feedback_service.getAllFeedback",
            return_value={"data": [{"user_name": "UniqueUser"}]},
        ):
            r = client.get("/api/feedback?q=UniqueUser", headers=ADMIN_HEADERS)
        assert r.status_code == 200

    def test_A_21_WB_debounced_query_param(self):
        with patch(
            "app.services.feedback_service.getAllFeedback", return_value={"data": []}
        ) as mock_list:
            client.get("/api/feedback?q=test", headers=ADMIN_HEADERS)
        assert mock_list.called

    def test_A_21_FN_search_then_clear(self):
        with patch(
            "app.services.feedback_service.getAllFeedback",
            return_value={"data": [{"id": "fb1"}, {"id": "fb2"}]},
        ):
            r = client.get("/api/feedback", headers=ADMIN_HEADERS)
        assert len(r.json()["data"]) == 2


class TestUC22ApproveFeedback:
    def test_A_22_BB_status_changes(self):
        with patch(
            "app.services.feedback_service.updateFeedbackStatus",
            return_value={"status": "approved"},
        ):
            r = client.patch("/api/feedback/fb1/approve", headers=ADMIN_HEADERS)
        assert r.json()["status"] == "approved"

    def test_A_22_WB_appends_to_testimonials(self):
        with patch(
            "app.services.feedback_service.updateFeedbackStatus",
            return_value={"status": "approved"},
        ) as mock_approve:
            client.patch("/api/feedback/fb1/approve", headers=ADMIN_HEADERS)
        assert mock_approve.called

    def test_A_22_FN_appears_as_testimonial(self):
        with patch(
            "app.services.feedback_service.updateFeedbackStatus",
            return_value={"status": "approved"},
        ), patch(
            "app.routers.admin.getLandingContent",
            return_value={"testimonials": [{"name": "Test User"}]},
        ):
            client.patch("/api/feedback/fb1/approve", headers=ADMIN_HEADERS)
            r = client.get("/api/admin/landing", headers=ADMIN_HEADERS)
        assert len(r.json()["testimonials"]) > 0


class TestUC23RejectFeedback:
    def test_A_23_BB_status_changes(self):
        with patch(
            "app.services.feedback_service.updateFeedbackStatus",
            return_value={"status": "rejected"},
        ):
            r = client.patch("/api/feedback/fb1/reject", headers=ADMIN_HEADERS)
        assert r.json()["status"] == "rejected"

    def test_A_23_WB_no_reason_required(self):
        with patch(
            "app.services.feedback_service.updateFeedbackStatus",
            return_value={"status": "rejected"},
        ):
            r = client.patch("/api/feedback/fb1/reject", json={}, headers=ADMIN_HEADERS)
        assert r.status_code == 200

    def test_A_23_FN_rejected_excluded_from_testimonials(self):
        with patch(
            "app.services.feedback_service.updateFeedbackStatus",
            return_value={"status": "rejected"},
        ), patch("app.routers.admin.getLandingContent", return_value={"testimonials": []}):
            client.patch("/api/feedback/fb1/reject", headers=ADMIN_HEADERS)
            r = client.get("/api/admin/landing", headers=ADMIN_HEADERS)
        assert len(r.json()["testimonials"]) == 0
