"""Run the golden set against different search setups and save the numbers.

cd backend && uv run python ../evals/run_retrieval.py
"""

from __future__ import annotations

import json
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "backend"))

from app.db import connect  # noqa: E402
from app.rag.metrics import summarize  # noqa: E402
from app.rag.search import search  # noqa: E402
from app.tracing import setup_tracing  # noqa: E402

K = 10

# name -> search() options
SETUPS = {
    "keyword only": dict(use_vector=False, use_rerank=False),
    "vector only (song)": dict(use_keyword=False, use_rerank=False, strategy="song"),
    "vector only (stanza)": dict(use_keyword=False, use_rerank=False, strategy="stanza"),
    "hybrid (song)": dict(use_rerank=False, strategy="song"),
    "hybrid (stanza)": dict(use_rerank=False, strategy="stanza"),
    "hybrid + rerank (song)": dict(strategy="song"),
    "hybrid + rerank (stanza)": dict(strategy="stanza"),
    "vector + rerank (song+stanza)": dict(use_keyword=False),
    "hybrid + rerank (song+stanza)": dict(),
}


def main() -> None:
    setup_tracing()  # only if PHOENIX_COLLECTOR_ENDPOINT is set
    golden = [json.loads(line) for line in (ROOT / "datasets" / "golden.jsonl").open()]
    results = {}
    with connect() as conn:
        search(conn, "warmup", k=1)  # load the models once
        for name, opts in SETUPS.items():
            runs, runs_by_lang, times = [], {"en": [], "el": []}, []
            for g in golden:
                t = time.perf_counter()
                hits = search(conn, g["query"], k=K, **opts)
                times.append(time.perf_counter() - t)
                run = ([h.song_id for h in hits], set(g["relevant"]))
                runs.append(run)
                runs_by_lang[g["lang"]].append(run)
            results[name] = {
                **summarize(runs, K),
                "mrr_en": summarize(runs_by_lang["en"], K)["mrr"],
                "mrr_el": summarize(runs_by_lang["el"], K)["mrr"],
                "p50_s": statistics.median(times),
            }
            r = results[name]
            print(
                f"{name:30s} hit@1 {r['hit@1']:.2f}  hit@10 {r['hit@10']:.2f}  "
                f"mrr {r['mrr']:.3f}  (en {r['mrr_en']:.3f} / el {r['mrr_el']:.3f})  "
                f"p50 {r['p50_s']:.2f}s"
            )

    out = ROOT / "results" / "retrieval.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"queries": len(golden), "k": K, "setups": results}, indent=2))
    print(f"\nsaved to {out.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
