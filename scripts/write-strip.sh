#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PANEL=""
OUT=""
MAX=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --panel) PANEL="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --max-iters) MAX="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$PANEL" ]]; then PANEL="$ROOT/fixtures/sample/panel.json"; fi
if [[ -z "$OUT" ]]; then OUT="$ROOT/out/strip.png"; fi
if ! [[ "$MAX" =~ ^[0-9]+$ ]] || [[ "$MAX" -lt 1 ]]; then MAX=1; fi

mkdir -p "$ROOT/out" "$ROOT/work" "$(dirname "$OUT")"

echo "[write-strip] panel=$PANEL out=$OUT max-iters=$MAX"
if [[ ! -s "$ROOT/assets/fonts/PatrickHand-Regular.ttf" ]]; then
  echo "[write-strip] vendored font missing; fetching via scripts/fetch-fonts.sh"
  bash "$ROOT/scripts/fetch-fonts.sh"
fi

current="$PANEL"
for ((n = 1; n <= MAX; n++)); do
  echo "[write-strip] attempt $n/$MAX: rendering $current -> $OUT"
  node "$ROOT/src/renderer/render-strip.js" --panel "$current"

  if node "$ROOT/scripts/verify_strip.js" --panel "$current"; then
    echo "[write-strip] PASS on attempt $n/$MAX — $OUT is verified (out/verify.json)"
    exit 0
  fi

  echo "[write-strip] FAIL on attempt $n/$MAX (see out/verify.json)"
  feedback="$(node --input-type=commonjs -e "console.log(JSON.parse(require('fs').readFileSync('$ROOT/out/verify.json','utf8')).feedback)")"
  echo "[write-strip] feedback: $feedback"
  echo "=== attempt $n ===" >> "$ROOT/work/feedback.txt"
  echo "$feedback" >> "$ROOT/work/feedback.txt"

  mkdir -p "$ROOT/work/attempt-$n"
  cp "$current" "$ROOT/work/attempt-$n/panel.json"
  cp "$ROOT/out/verify.json" "$ROOT/work/attempt-$n/verify.json"
  echo "[write-strip] candidate copied to work/attempt-$n/panel.json"
  echo "[write-strip] NOTE: agentic revision happens outside the shell — hand this feedback to the writer,"
  echo "[write-strip] then re-run with --panel work/attempt-$n/panel.json to continue."

  current="$ROOT/work/attempt-$n/panel.json"
done

echo "[write-strip] exhausted $MAX iterations without a PASS (exit 2)" >&2
exit 2