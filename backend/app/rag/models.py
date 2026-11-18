"""models that run locally on cpu (onnx with fastembed). free and no api key needed"""

from __future__ import annotations

import os
from functools import lru_cache

import numpy as np

EMBED_MODEL = os.environ.get(
    "LYRISENSE_EMBED_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)
EMBED_DIM = 384
RERANK_MODEL = os.environ.get("LYRISENSE_RERANK_MODEL", "jinaai/jina-reranker-v2-base-multilingual")


@lru_cache
def _embedder():
    from fastembed import TextEmbedding

    return TextEmbedding(EMBED_MODEL)


@lru_cache
def _reranker():
    from fastembed.rerank.cross_encoder import TextCrossEncoder

    return TextCrossEncoder(RERANK_MODEL)


def embed(texts: list[str], batch_size: int = 256) -> np.ndarray:
    return np.asarray(list(_embedder().embed(texts, batch_size=batch_size)), dtype=np.float32)


def rerank(query: str, docs: list[str]) -> list[float]:
    return [float(s) for s in _reranker().rerank(query, docs)]
