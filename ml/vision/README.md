# vision

The on-device image model behind the child app's vision channel.

- Model: `taufiqdp/mobilenetv4_conv_small.e2400_r224_in1k_nsfw_classifier` (Hugging Face, Apache 2.0). MobileNetV4 small, 5 classes: drawings, hentai, neutral, porn, sexy. About 10 MB. Input is a single float32 image, shape [3, 224, 224], values 0 to 1 in RGB; the ImageNet mean/std normalisation is baked into the graph. Output is [1, 5] logits.
- Runtime on the phone: ONNX Runtime Android (`com.microsoft.onnxruntime:onnxruntime-android`), 2 threads, CPU.
- File in the app: `apps/child/models/nsfw.onnx`, copied to `assets/nsfw.onnx` by `plugins/withChildPermissions.js`.

Refresh the model:

```bash
curl -L -o apps/child/models/nsfw.onnx \
  https://huggingface.co/taufiqdp/mobilenetv4_conv_small.e2400_r224_in1k_nsfw_classifier/resolve/main/mobilenetv4_conv_small.e2400_r224_in1k_nsfw_classifier.onnx
cd ml/vision && uv sync && uv run python validate.py [image.jpg ...]
```

`validate.py` checks the graph, prints the class order, runs a few synthetic frames and any images you pass, and reports per frame latency on this Mac.

Decision rule on the phone (`NsfwClassifier.toClassification`): neutral at or above 0.40 is ignored; porn + hentai at or above 0.85 is Sexual Content high, at or above 0.65 review; sexy at or above 0.85 low. Nearly flat frames never reach the model. Thresholds are deliberately conservative; the classifier only ever emits a category, never the frame.
