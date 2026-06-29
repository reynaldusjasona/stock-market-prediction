import pytest
import requests

BASE_URL = "http://localhost:8000"

# Replace with valid tokens before running
INVESTOR_TOKEN = "REPLACE_WITH_INVESTOR_JWT"  # role=investor
ADMIN_TOKEN = "REPLACE_WITH_ADMIN_JWT"        # role=admin

INVESTOR_HEADERS = {"Authorization": f"Bearer {INVESTOR_TOKEN}"}
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


def _server_available() -> bool:
    try:
        requests.get("http://localhost:8000/health", timeout=2)
        return True
    except Exception:
        return False


SERVER_UP = _server_available()


@pytest.mark.skipif(
    not SERVER_UP,
    reason="Server not running on localhost:8000 — skipping integration tests",
)
@pytest.mark.integration
class TestFeedbackAPI:
    def test_all(self):
        passed = 0
        failed = 0

        def test(name: str, result: bool) -> None:
            nonlocal passed, failed
            if result:
                passed += 1
                print(f"PASS — {name}")
            else:
                failed += 1
                print(f"FAIL — {name}")

        # ---- Test 1: POST without auth → 401 or 422 ----
        r = requests.post(f"{BASE_URL}/api/feedback", json={"subject": "x", "message": "y"})
        test("Test 1: POST /api/feedback without auth → 401/422", r.status_code in (401, 422))

        # ---- Test 2: POST with admin token → 403 ----
        r = requests.post(
            f"{BASE_URL}/api/feedback",
            json={"subject": "Admin submit", "message": "Should be rejected"},
            headers=ADMIN_HEADERS,
        )
        test("Test 2: POST /api/feedback with admin token → 403", r.status_code == 403)

        # ---- Test 3: POST with investor token, empty body → 422 ----
        r = requests.post(f"{BASE_URL}/api/feedback", json={}, headers=INVESTOR_HEADERS)
        test("Test 3: POST /api/feedback with investor token, empty body → 422", 
            r.status_code == 422
        )

        # ---- Test 4: POST valid feedback as investor → 201 ----
        r = requests.post(
            f"{BASE_URL}/api/feedback",
            json={"subject": "Test Feedback", "message": "This is a test feedback message"},
            headers=INVESTOR_HEADERS,
        )
        ok = (
            r.status_code == 201
            and "id" in r.json()
            and r.json().get("subject") == "Test Feedback"
            and r.json().get("message") == "This is a test feedback message"
            and r.json().get("status") == "pending"
        )
        test("Test 4: POST /api/feedback valid → 201, has id/subject/message/status=pending", ok)
        feedback_id_1 = r.json().get("id") if r.status_code == 201 else None

        # ---- Test 5: POST second feedback as investor → 201 ----
        r = requests.post(
            f"{BASE_URL}/api/feedback",
            json={"subject": "Second Feedback", "message": "Another message"},
            headers=INVESTOR_HEADERS,
        )
        ok = r.status_code == 201 and r.json().get("status") == "pending"
        test("Test 5: POST second feedback → 201 (multiple submissions allowed)", ok)
        feedback_id_2 = r.json().get("id") if r.status_code == 201 else None

        # ---- Test 6: GET with investor token → 403 ----
        r = requests.get(f"{BASE_URL}/api/feedback", headers=INVESTOR_HEADERS)
        test("Test 6: GET /api/feedback with investor token → 403", r.status_code == 403)

        # ---- Test 7: GET with admin token → 200, paginated ----
        r = requests.get(f"{BASE_URL}/api/feedback", headers=ADMIN_HEADERS)
        ok = (
            r.status_code == 200
            and isinstance(r.json().get("data"), list)
            and r.json().get("total", 0) >= 2
            and "page" in r.json()
            and "limit" in r.json()
        )
        test("Test 7: GET /api/feedback with admin → 200, data/total/page/limit present", ok)

        # ---- Test 8: GET ?status=pending with admin → 200, all pending ----
        r = requests.get(f"{BASE_URL}/api/feedback?status=pending", headers=ADMIN_HEADERS)
        items = r.json().get("data", [])
        ok = r.status_code == 200 and all(item.get("status") == "pending" for item in items)
        test("Test 8: GET ?status=pending → 200, all items are pending", ok)

        # ---- Test 9: GET ?status=invalid with admin → 400 ----
        r = requests.get(f"{BASE_URL}/api/feedback?status=invalid", headers=ADMIN_HEADERS)
        test("Test 9: GET ?status=invalid → 400", r.status_code == 400)

        # ---- Test 10: PATCH approve (id from Test 4) → 200, status=approved ----
        if feedback_id_1:
            r = requests.patch(
                f"{BASE_URL}/api/feedback/{feedback_id_1}/approve", headers=ADMIN_HEADERS
            )
            ok = (
                r.status_code == 200
                and r.json().get("status") == "approved"
                and r.json().get("responded_at") is not None
            )
            test("Test 10: PATCH approve → 200, status=approved, responded_at set", ok)
        else:
            test("Test 10: PATCH approve (skipped — no feedback_id from Test 4)", False)

        # ---- Test 11: PATCH reject (id from Test 5) → 200, status=rejected ----
        if feedback_id_2:
            r = requests.patch(
                f"{BASE_URL}/api/feedback/{feedback_id_2}/reject", headers=ADMIN_HEADERS
            )
            ok = (
                r.status_code == 200
                and r.json().get("status") == "rejected"
                and r.json().get("responded_at") is not None
            )
            test("Test 11: PATCH reject → 200, status=rejected, responded_at set", ok)
        else:
            test("Test 11: PATCH reject (skipped — no feedback_id from Test 5)", False)

        # ---- Test 12: GET ?status=approved with admin → 200, includes approved item ----
        r = requests.get(f"{BASE_URL}/api/feedback?status=approved", headers=ADMIN_HEADERS)
        items = r.json().get("data", [])
        ok = (
            r.status_code == 200
            and len(items) >= 1
            and all(item.get("status") == "approved" for item in items)
        )
        test("Test 12: GET ?status=approved → 200, includes approved item", ok)

        # ---- Test 13: PATCH approve with non-existent UUID → 404 ----
        r = requests.patch(
            f"{BASE_URL}/api/feedback/00000000-0000-0000-0000-000000000000/approve",
            headers=ADMIN_HEADERS,
        )
        test("Test 13: PATCH approve non-existent UUID → 404", r.status_code == 404)

        # ---- Test 14: PATCH approve with investor token → 403 ----
        if feedback_id_1:
            r = requests.patch(
                f"{BASE_URL}/api/feedback/{feedback_id_1}/approve", headers=INVESTOR_HEADERS
            )
            test("Test 14: PATCH approve with investor token → 403", r.status_code == 403)
        else:
            test("Test 14: PATCH approve with investor token (skipped — no feedback_id)", False)

        # ---- Summary ----
        total = passed + failed
        print(f"\n{passed}/{total} tests passed")
