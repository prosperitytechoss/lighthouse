# Models

Three files belong here. None are in the repository.

| File | What | Where from |
|---|---|---|
| `keeper.onnx`, `keeper.spm`, `keeper.json` | Lighthouse Keeper, the text model, 9 MB | Run `scripts/fetch-keeper.sh`. Apache 2.0, from https://huggingface.co/Prosperitytech/lighthouse-keeper |
| `nsfw.onnx` | MobileNetV4 small nudity classifier, 10 MB | Public, Apache 2.0. See `ml/vision/README.md` for the download command. |

The Android build stops if the Keeper files are missing. Vision stays off until `nsfw.onnx` is present.
