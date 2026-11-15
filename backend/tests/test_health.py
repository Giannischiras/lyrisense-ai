from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_never_leaks_secrets(monkeypatch):
    fake = "fake-secret-value-MUST-NOT-LEAK"
    monkeypatch.setenv("ANTHROPIC_API_KEY", fake)
    from app.config import Settings

    s = Settings()
    assert fake not in repr(s)
    assert fake not in s.model_dump_json()
    assert fake not in client.get("/health").text
