"""metrics for the search evals (hit@k and mrr)"""

from __future__ import annotations

from statistics import mean


def hit_at_k(ranked: list[int], relevant: set[int], k: int) -> float:
    return 1.0 if any(sid in relevant for sid in ranked[:k]) else 0.0


def reciprocal_rank(ranked: list[int], relevant: set[int], k: int = 10) -> float:
    for i, sid in enumerate(ranked[:k], start=1):
        if sid in relevant:
            return 1.0 / i
    return 0.0


def summarize(runs: list[tuple[list[int], set[int]]], k: int = 10) -> dict[str, float]:
    """runs is a list of (ranked ids, correct ids), returns the averages"""
    if not runs:
        return {"hit@1": 0.0, "hit@5": 0.0, f"hit@{k}": 0.0, "mrr": 0.0}
    return {
        "hit@1": mean(hit_at_k(r, rel, 1) for r, rel in runs),
        "hit@5": mean(hit_at_k(r, rel, 5) for r, rel in runs),
        f"hit@{k}": mean(hit_at_k(r, rel, k) for r, rel in runs),
        "mrr": mean(reciprocal_rank(r, rel, k) for r, rel in runs),
    }
