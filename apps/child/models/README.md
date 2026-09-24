# Models

Two files belong here. Neither is in the repository.

| File | What | Where from |
|---|---|---|
| `nsfw.onnx` | MobileNetV4 small nudity classifier, 10 MB | Public, Apache 2.0. See `ml/vision/README.md` for the download command. |
| `textmodel.bin` | Lighthouse text model, 1.5 MB | Train your own with `ml/textmodel`. The model shipped in the Play Store app is not published. |

The app builds and runs without them. Vision and the text model stay off until the files are present.
