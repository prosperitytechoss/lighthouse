import numpy as np
from scipy.sparse import csr_matrix

from features import CATEGORIES, SEVERITIES

CLIP_PCT = 99.95


def quantize_head(W: np.ndarray, b: np.ndarray):
    W = np.asarray(W, dtype=np.float64)
    n_classes = W.shape[1]
    scales = np.zeros(n_classes, dtype=np.float32)
    Wq = np.zeros(W.shape, dtype=np.int8)
    for c in range(n_classes):
        col = W[:, c]
        clip = float(np.percentile(np.abs(col), CLIP_PCT))
        if clip <= 0:
            clip = float(np.abs(col).max()) or 1.0
        s = clip / 127.0
        scales[c] = np.float32(s)
        Wq[:, c] = np.clip(np.round(col / s), -127, 127).astype(np.int8)
    return Wq, scales, np.asarray(b, dtype=np.float32)


class QuantModel:
    def __init__(self, cat, sev):
        self.cat_Wq, self.cat_scale, self.cat_b = cat
        self.sev_Wq, self.sev_scale, self.sev_b = sev
        self.cat_W = self.cat_Wq.astype(np.float32) * self.cat_scale[None, :]
        self.sev_W = self.sev_Wq.astype(np.float32) * self.sev_scale[None, :]

    @staticmethod
    def _softmax(z: np.ndarray) -> np.ndarray:
        z = z - z.max(axis=1, keepdims=True)
        e = np.exp(z)
        return e / e.sum(axis=1, keepdims=True)

    def probs(self, X: csr_matrix):
        pc = self._softmax(X @ self.cat_W + self.cat_b)
        ps = self._softmax(X @ self.sev_W + self.sev_b)
        return pc, ps

    def predict(self, X: csr_matrix):
        pc, ps = self.probs(X)
        ci = pc.argmax(axis=1)
        si = ps.argmax(axis=1)
        out = []
        for i in range(X.shape[0]):
            out.append(
                {
                    "category": CATEGORIES[ci[i]],
                    "severity": SEVERITIES[si[i]],
                    "confidence": float(pc[i, ci[i]]),
                    "sevConfidence": float(ps[i, si[i]]),
                }
            )
        return out
