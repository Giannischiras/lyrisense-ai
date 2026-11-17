"""Plain logging for the backend. Never log keys, tokens or full prompts."""

from __future__ import annotations

import logging
import os
from contextvars import ContextVar

log = logging.getLogger("wavelength")

# LLM calls made during the current agent step (the UI shows them under the step)
llm_calls: ContextVar[list[dict] | None] = ContextVar("llm_calls", default=None)


def setup_logging() -> None:
    if log.handlers:
        return
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)-5s %(message)s", "%H:%M:%S"))
    log.addHandler(h)
    log.setLevel(os.environ.get("WAVELENGTH_LOG_LEVEL", "INFO"))
    log.propagate = False
