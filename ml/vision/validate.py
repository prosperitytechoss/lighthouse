import sys, time, json
from pathlib import Path
import numpy as np
import onnx
import onnxruntime as ort
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT / "apps/child/models/nsfw.onnx"
LABELS = ["drawings", "hentai", "neutral", "porn", "sexy"]


def preprocess(img: Image.Image) -> np.ndarray:
    w, h = img.size
    side = min(w, h)
    img = img.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2)).resize((224, 224), Image.BICUBIC)
    x = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    return np.ascontiguousarray(x.transpose(2, 0, 1))


def softmax(z):
    e = np.exp(z - z.max())
    return e / e.sum()


def main():
    m = onnx.load(str(MODEL))
    onnx.checker.check_model(m)
    inp = m.graph.input[0]
    print("opset", [o.version for o in m.opset_import], "input", inp.name, [d.dim_value or d.dim_param for d in inp.type.tensor_type.shape.dim])
    sess = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    name = sess.get_inputs()[0].name
    samples = {}
    rng = np.random.default_rng(0)
    samples["noise"] = Image.fromarray(rng.integers(0, 255, (400, 400, 3), dtype=np.uint8))
    samples["white"] = Image.new("RGB", (400, 800), (255, 255, 255))
    samples["chat_like"] = Image.new("RGB", (1080, 2400), (240, 240, 240))
    for p in sys.argv[1:]:
        samples[Path(p).name] = Image.open(p)
    for k, img in samples.items():
        x = preprocess(img)
        t = time.perf_counter()
        logits = sess.run(None, {name: x})[0][0]
        ms = (time.perf_counter() - t) * 1000
        probs = softmax(logits)
        print(f"{k:>14}: " + ", ".join(f"{l}={p:.2f}" for l, p in zip(LABELS, probs)) + f"  ({ms:.1f} ms)")
    print("size MB", round(MODEL.stat().st_size / 1e6, 2))


if __name__ == "__main__":
    main()
