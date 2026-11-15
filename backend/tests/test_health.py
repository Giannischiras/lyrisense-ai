from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
FAKE = "fake-secret-value-MUST-NOT-LEAK"


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_key_is_never_returned(caplog):
    sid = client.post("/session").json()["session_id"]
    h = {"X-Session-Id": sid}
    assert (
        client.post("/session/keys", json={"name": "groq", "value": FAKE}, headers=h).status_code
        == 204
    )

    r = client.get("/session/keys", headers=h)
    assert r.json() == {"configured": ["groq"]}
    assert FAKE not in r.text
    assert FAKE not in caplog.text


def test_unknown_session_rejected():
    r = client.post(
        "/session/keys", json={"name": "groq", "value": FAKE}, headers={"X-Session-Id": "nope"}
    )
    assert r.status_code == 401


def test_end_session_wipes_keys():
    sid = client.post("/session").json()["session_id"]
    h = {"X-Session-Id": sid}
    client.post("/session/keys", json={"name": "gemini", "value": FAKE}, headers=h)
    assert client.delete("/session", headers=h).status_code == 204
    assert client.get("/session/keys", headers=h).status_code == 401
