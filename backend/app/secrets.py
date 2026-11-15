"""In-memory, per-session key vault.

Keys the user pastes into the UI live here and nowhere else: not on disk, not
in the database, not in logs. A session is identified by a random id that the
browser keeps in memory only. Sessions expire after inactivity and everything
disappears when the process stops.
"""

from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass, field

from pydantic import SecretStr

SESSION_TTL_SECONDS = 2 * 60 * 60


@dataclass
class _Session:
    keys: dict[str, SecretStr] = field(default_factory=dict)
    last_seen: float = field(default_factory=time.monotonic)


class KeyVault:
    def __init__(self, ttl: float = SESSION_TTL_SECONDS) -> None:
        self._ttl = ttl
        self._sessions: dict[str, _Session] = {}
        self._lock = threading.Lock()

    def create_session(self) -> str:
        sid = secrets.token_urlsafe(32)
        with self._lock:
            self._purge()
            self._sessions[sid] = _Session()
        return sid

    def set_key(self, sid: str, name: str, value: str) -> None:
        with self._lock:
            s = self._get(sid)
            s.keys[name] = SecretStr(value)

    def get_key(self, sid: str, name: str) -> str | None:
        with self._lock:
            s = self._get(sid)
            v = s.keys.get(name)
            return v.get_secret_value() if v else None

    def configured(self, sid: str) -> list[str]:
        with self._lock:
            return sorted(self._get(sid).keys)

    def end_session(self, sid: str) -> None:
        with self._lock:
            self._sessions.pop(sid, None)

    def _get(self, sid: str) -> _Session:
        self._purge()
        s = self._sessions.get(sid)
        if s is None:
            raise KeyError("unknown or expired session")
        s.last_seen = time.monotonic()
        return s

    def _purge(self) -> None:
        now = time.monotonic()
        for sid in [k for k, v in self._sessions.items() if now - v.last_seen > self._ttl]:
            del self._sessions[sid]

    def __repr__(self) -> str:  # never print key material
        return f"KeyVault(sessions={len(self._sessions)})"


vault = KeyVault()
