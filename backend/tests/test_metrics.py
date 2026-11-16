from app.rag.metrics import hit_at_k, reciprocal_rank, summarize


def test_hit_at_k():
    assert hit_at_k([5, 3, 9], {3}, 1) == 0.0
    assert hit_at_k([5, 3, 9], {3}, 2) == 1.0


def test_reciprocal_rank():
    assert reciprocal_rank([5, 3, 9], {9}) == 1 / 3
    assert reciprocal_rank([5, 3, 9], {7}) == 0.0
    assert reciprocal_rank(list(range(20)), {15}, k=10) == 0.0


def test_summarize():
    s = summarize([([1, 2], {1}), ([1, 2], {2}), ([1, 2], {9})])
    assert s["hit@1"] == 1 / 3
    assert s["mrr"] == (1 + 0.5 + 0) / 3
    assert summarize([])["mrr"] == 0.0
