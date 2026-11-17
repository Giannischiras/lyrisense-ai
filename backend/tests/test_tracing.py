from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from app import tracing


def test_tracing_off_without_endpoint(monkeypatch):
    monkeypatch.delenv("PHOENIX_COLLECTOR_ENDPOINT", raising=False)
    monkeypatch.setattr(tracing, "_configured", False)
    assert tracing.setup_tracing() is False


def test_spans_are_recorded_and_hold_no_keys(monkeypatch):
    from app.secrets import KeyVault

    exporter = InMemorySpanExporter()
    monkeypatch.setattr(tracing, "_configured", False)
    assert tracing.setup_tracing(exporter=exporter)

    vault = KeyVault()
    sid = vault.create_session()
    vault.set_key(sid, "groq", "gsk_test_secret_value_123")
    with tracing.tracer().start_as_current_span("search") as span:
        span.set_attribute("query", "sad songs about rain")
    tracing.trace.get_tracer_provider().force_flush()

    spans = exporter.get_finished_spans()
    assert [s.name for s in spans] == ["search"]
    dumped = " ".join(str(dict(s.attributes)) for s in spans)
    assert "gsk_test_secret_value_123" not in dumped
