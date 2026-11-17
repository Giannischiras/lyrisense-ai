"""run the agent from the terminal.

cd backend && uv run python try_agent.py groq

it asks for your api key (hidden input). the key is only kept while it runs,
nothing gets saved.
"""

from __future__ import annotations

import getpass
import json
import sys

from app.agent.graph import run_agent
from app.agent.llm import PROVIDERS, make_llm
from app.db import connect
from app.rag.search import search


def main() -> None:
    provider = sys.argv[1] if len(sys.argv) > 1 else "groq"
    if provider not in PROVIDERS:
        sys.exit(f"provider must be one of {', '.join(PROVIDERS)}")
    key = getpass.getpass(f"{provider} API key (hidden): ").strip()
    llm = make_llm(provider, key)
    del key

    with connect() as conn:

        def search_fn(query, filters, k):
            return search(conn, query, filters, k=k)

        while True:
            try:
                text = input("\nWhat do you want to listen to? (empty to quit) > ").strip()
            except EOFError:
                break
            if not text:
                break
            out = run_agent(llm, search_fn, text)
            print(f"\n== {out['title']} ==")
            for i, s in enumerate(out["songs"], 1):
                print(f"{i:2d}. {s['title']} - {s['artist']} ({s['year']})")
                print(f"    {s['reason']}")
            print("\nsteps:")
            for st in out["steps"]:
                extra = {k: v for k, v in st.items() if k not in ("step", "ms")}
                print(f"  {st['step']:14s} {st['ms']:6d} ms  {json.dumps(extra)[:150]}")


if __name__ == "__main__":
    main()
