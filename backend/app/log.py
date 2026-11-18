"""simple logging for the backend. dont log keys, tokens or full prompts"""

from __future__ import annotations

import logging
import os
from contextvars import ContextVar

log = logging.getLogger("lyrisense")

# llm calls in the current step, the ui shows them under each step
llm_calls: ContextVar[list[dict] | None] = ContextVar("llm_calls", default=None)


def setup_logging() -> None:
    if log.handlers:
        return
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)-5s %(message)s", "%H:%M:%S"))
    log.addHandler(h)
    log.setLevel(os.environ.get("LYRISENSE_LOG_LEVEL", "INFO"))
    log.propagate = False
