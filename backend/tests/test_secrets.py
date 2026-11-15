import time

import pytest

from app.secrets import KeyVault

FAKE = "fake-secret-value-MUST-NOT-LEAK"


def test_vault_roundtrip_and_repr_hides_value():
    v = KeyVault()
    sid = v.create_session()
    v.set_key(sid, "groq", FAKE)
    assert v.get_key(sid, "groq") == FAKE
    assert FAKE not in repr(v)
    assert FAKE not in repr(v._sessions)


def test_sessions_expire():
    v = KeyVault(ttl=0.01)
    sid = v.create_session()
    v.set_key(sid, "groq", FAKE)
    time.sleep(0.05)
    with pytest.raises(KeyError):
        v.get_key(sid, "groq")


def test_sessions_are_isolated():
    v = KeyVault()
    a, b = v.create_session(), v.create_session()
    v.set_key(a, "groq", FAKE)
    assert v.get_key(b, "groq") is None
