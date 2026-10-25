#!/usr/bin/env bash
set -euo pipefail
VERSION="${KEEPER_VERSION:-0.1}"
RUN="${KEEPER_RUN:-k4}"
REPO="${KEEPER_REPO:-zoboteam/lighthouse-keeper-runs}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/apps/child/models"
: "${HF_TOKEN:?Set HF_TOKEN to a Hugging Face token that can read $REPO}"
mkdir -p "$OUT"
for f in keeper-int8.onnx:keeper.onnx keeper.spm:keeper.spm; do
  src="${f%%:*}"; dst="${f##*:}"
  curl -fsSL -H "Authorization: Bearer $HF_TOKEN" "https://huggingface.co/$REPO/resolve/main/$RUN/$src" -o "$OUT/$dst"
done
ONNX_SHA=$(shasum -a 256 "$OUT/keeper.onnx" | cut -d' ' -f1)
SPM_SHA=$(shasum -a 256 "$OUT/keeper.spm" | cut -d' ' -f1)
MIN_RISK="${KEEPER_MIN_RISK:-0.8}"
printf '{"version":"%s","run":"%s","minRisk":%s,"onnxSha256":"%s","spmSha256":"%s"}\n' "$VERSION" "$RUN" "$MIN_RISK" "$ONNX_SHA" "$SPM_SHA" > "$OUT/keeper.json"
echo "Keeper $VERSION ($RUN) in $OUT"
