#!/usr/bin/env bash
set -euo pipefail
VERSION="${KEEPER_VERSION:-0.1}"
REPO="${KEEPER_REPO:-Prosperitytech/lighthouse-keeper}"
REV="${KEEPER_REV:-v$VERSION}"
MIN_RISK="${KEEPER_MIN_RISK:-0.8}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/apps/child/models"
AUTH=()
if [ -n "${HF_TOKEN:-}" ]; then AUTH=(-H "Authorization: Bearer $HF_TOKEN"); fi
mkdir -p "$OUT"
for f in keeper.onnx keeper.spm; do
  curl -fsSL ${AUTH[@]+"${AUTH[@]}"} "https://huggingface.co/$REPO/resolve/$REV/$f" -o "$OUT/$f"
done
ONNX_SHA=$(shasum -a 256 "$OUT/keeper.onnx" | cut -d' ' -f1)
SPM_SHA=$(shasum -a 256 "$OUT/keeper.spm" | cut -d' ' -f1)
printf '{"version":"%s","minRisk":%s,"onnxSha256":"%s","spmSha256":"%s"}\n' "$VERSION" "$MIN_RISK" "$ONNX_SHA" "$SPM_SHA" > "$OUT/keeper.json"
echo "Keeper $VERSION in $OUT"
