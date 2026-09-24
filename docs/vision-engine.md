# Vision engine (child app)

Text capture misses what is drawn, not typed: captions burned into TikTok videos, screenshots of chats, memes, and images. The vision engine closes that gap on the phone.

## Loop

```
foreground app is watched
  -> AccessibilityService.takeScreenshot (Android 11+, no MediaProjection prompt)
  -> software bitmap
  -> 8x8 thumbnail hash, skip if the screen has not changed
  -> ML Kit text recognition (on device, Latin script) -> text -> LighthouseClassifier.classify
  -> MobileNetV4 NSFW model via ONNX Runtime (1 to 3 square crops) -> porn / hentai / sexy scores
  -> {category, severity, app, time, channel} into SignalBuffer
  -> bitmap.recycle(); nothing written to disk, nothing uploaded
```

Files: `apps/child/native-src/VisionEngine.kt` (scheduler + pipeline), `OcrEngine.kt`, `NsfwClassifier.kt`, `DeviceTier.kt`, `SignalBuffer.kt`. Started and stopped by `ContentAccessibilityService`. Signals drain through the existing `LighthouseMonitorService` upload loop with `channel` = `ocr` or `image` (text capture sends `text`, notifications send `notification`).

## Cadence

| Tier | Picked when | Interval | OCR width | Image crops |
|---|---|---|---|---|
| fast | 4.5 GB+ RAM and more than 4 cores | 15 s | 1080 px | 3 |
| mid | 2.5 to 4.5 GB RAM or 4 cores | 30 s | 720 px | 2 |
| slow | low RAM device, under 2.5 GB, or Android 11 | 60 s | 540 px | 1 |

At runtime a moving average of frame processing time adapts the tier: over 35 percent of the interval steps down, under 8 percent steps back toward the hardware tier. Battery at or under 15 percent and not charging forces 60 s. Frames are skipped when the screen is off, the keyguard is up, the device reports severe thermal status, the block overlay is showing, or the foreground app is not watched.

## Decision rule for images

Frames whose 8x8 thumbnail is nearly flat (blank screens, solid colours) skip the image model, because the model is unreliable off distribution (a pure white frame scores hentai 0.56 on the Mac). For the rest: neutral at or above 0.40 is ignored; porn + hentai at or above 0.85 is Sexual Content high, at or above 0.65 review; sexy at or above 0.85 low. Measured on the Mac: real screenshots score neutral 0.74 to 0.99, about 1.5 ms per 224 crop. The same `shouldBlock(result, parentThreshold)` rule as text decides whether the overlay covers the screen. Repeated hits for the same app + category + channel are collapsed to one signal per two minutes on the device.

## Privacy

The frame never leaves process memory. Debug builds log OCR text length and scrubbed snippets only under `BuildConfig.DEBUG`; release builds log nothing. The parent sees a category and the channel it came from, never the frame or the words.

## Play policy notes

`android:canTakeScreenshot="true"` is declared in `accessibility_service_config.xml`. The consent gate before enabling the Accessibility Service and the transparency screen both state that the screen is looked at every few seconds and thrown away (copy in `packages/copy/strings.ts`). This rides on the existing Accessibility Service and specialUse foreground service declarations.

## Not yet measured

Frame latency, battery cost per hour, and NSFW precision on a real Tecno. `LighthouseNative.visionStatus()` exposes tier, interval, frames checked, skipped, hits, and last OCR / image milliseconds for the on-device readout.
