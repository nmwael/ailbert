#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
FONT_SRC="https://raw.githubusercontent.com/google/fonts/main/ofl/patrickhand/PatrickHand-Regular.ttf"
FONT_OUT="$DIR/../assets/fonts/PatrickHand-Regular.ttf"

mkdir -p "$(dirname "$FONT_OUT")"

if [[ -s "$FONT_OUT" ]]; then
  echo "font present: $FONT_OUT (skipping download)"
  exit 0
fi

echo "fetching PatrickHand-Regular.ttf from google/fonts..."
curl -fsSL "$FONT_SRC" -o "$FONT_OUT"
if [[ ! -s "$FONT_OUT" ]]; then
  echo "error: font download produced an empty file" >&2
  rm -f "$FONT_OUT"
  exit 1
fi
echo "wrote $FONT_OUT"