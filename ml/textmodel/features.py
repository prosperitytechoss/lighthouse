import math
import unicodedata

import numpy as np
from scipy.sparse import csr_matrix

BUCKETS = 1 << 17
MASK = BUCKETS - 1
MAX_CP = 300
FNV_OFFSET = 0x811C9DC5
FNV_PRIME = 0x01000193
P_WORD = 1
P_BIGRAM = 2
P_CHAR = 3

CATEGORIES = [
    "Self-Harm",
    "Eating Disorders",
    "Sexual Content",
    "Violence",
    "Graphic Content",
    "Substance Use",
    "Hate Speech",
    "Gambling",
    "SAFE",
]
SEVERITIES = ["high", "review", "low"]


def fnv_byte(h: int, b: int) -> int:
    return ((h ^ b) * FNV_PRIME) & 0xFFFFFFFF


def fnv_cp(h: int, cp: int) -> int:
    if cp < 0x80:
        return fnv_byte(h, cp)
    if cp < 0x800:
        h = fnv_byte(h, 0xC0 | (cp >> 6))
        return fnv_byte(h, 0x80 | (cp & 0x3F))
    if cp < 0x10000:
        h = fnv_byte(h, 0xE0 | (cp >> 12))
        h = fnv_byte(h, 0x80 | ((cp >> 6) & 0x3F))
        return fnv_byte(h, 0x80 | (cp & 0x3F))
    h = fnv_byte(h, 0xF0 | (cp >> 18))
    h = fnv_byte(h, 0x80 | ((cp >> 12) & 0x3F))
    h = fnv_byte(h, 0x80 | ((cp >> 6) & 0x3F))
    return fnv_byte(h, 0x80 | (cp & 0x3F))


def is_token_cp(cp: int) -> bool:
    if cp < 0x80:
        return (0x61 <= cp <= 0x7A) or (0x30 <= cp <= 0x39) or (0x41 <= cp <= 0x5A)
    ch = chr(cp)
    if ch.isalpha():
        return True
    return unicodedata.category(ch) in ("Nd", "Nl", "No", "Mn")


def is_emoji_cp(cp: int) -> bool:
    return (0x1F000 <= cp <= 0x1FAFF) or (0x2600 <= cp <= 0x27BF)


def tokenize(text: str) -> list[list[int]]:
    tokens: list[list[int]] = []
    cur: list[int] = []
    n = 0
    for ch in text.lower():
        if n >= MAX_CP:
            break
        n += 1
        cp = ord(ch)
        if is_token_cp(cp):
            cur.append(cp)
        else:
            if cur:
                tokens.append(cur)
                cur = []
            if is_emoji_cp(cp):
                tokens.append([cp])
    if cur:
        tokens.append(cur)
    return tokens


def hash_cps(prefix: int, cps: list[int]) -> int:
    h = fnv_byte(FNV_OFFSET, prefix)
    for cp in cps:
        h = fnv_cp(h, cp)
    return h & MASK


def featurize(text: str) -> dict[int, float]:
    tokens = tokenize(text)
    counts: dict[int, int] = {}
    if not tokens:
        return {}
    for t in tokens:
        b = hash_cps(P_WORD, t)
        counts[b] = counts.get(b, 0) + 1
    for i in range(len(tokens) - 1):
        b = hash_cps(P_BIGRAM, tokens[i] + [32] + tokens[i + 1])
        counts[b] = counts.get(b, 0) + 1
    norm: list[int] = [32]
    for t in tokens:
        norm.extend(t)
        norm.append(32)
    L = len(norm)
    seed = fnv_byte(FNV_OFFSET, P_CHAR)
    for i in range(L):
        h = seed
        for k in range(5):
            if i + k >= L:
                break
            h = fnv_cp(h, norm[i + k])
            if k >= 2:
                b = h & MASK
                counts[b] = counts.get(b, 0) + 1
    s = math.sqrt(sum(v * v for v in counts.values()))
    return {b: v / s for b, v in counts.items()}


def to_csr(texts: list[str]) -> csr_matrix:
    indptr = [0]
    indices: list[int] = []
    data: list[float] = []
    for t in texts:
        f = featurize(t)
        for b in sorted(f):
            indices.append(b)
            data.append(f[b])
        indptr.append(len(indices))
    return csr_matrix(
        (np.asarray(data, dtype=np.float32), np.asarray(indices, dtype=np.int32), np.asarray(indptr, dtype=np.int64)),
        shape=(len(texts), BUCKETS),
    )
