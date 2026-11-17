"""tracing with opentelemetry, you can see it in phoenix (http://localhost:6006).

off by default, set PHOENIX_COLLECTOR_ENDPOINT (like http://localhost:6006/v1/traces)
to turn it on. it only sends to the local phoenix container.
dont put keys or tokens in the span attributes.
"""

from __future__ import annotations

import os

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter

_configured = False


def setup_tracing(exporter: SpanExporter | None = None) -> bool:
    """turns tracing on if the endpoint is set (or if a test passes an exporter)"""
    global _configured
    endpoint = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT")
    if _configured or (exporter is None and not endpoint):
        return _configured
    if exporter is None:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

        exporter = OTLPSpanExporter(endpoint=endpoint)
    provider = TracerProvider(resource=Resource.create({"service.name": "wavelength"}))
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    _configured = True
    return True


def tracer() -> trace.Tracer:
    return trace.get_tracer("wavelength")
