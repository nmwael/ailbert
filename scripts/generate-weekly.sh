#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAX_ITERS="${MAX_ITERS:-3}"
SLUG="weekly-$(date -u +%Y-%m-%d)"
WORK_DIR="$ROOT/work/weekly/$SLUG"
FEEDBACK_FILE="$WORK_DIR/feedback.txt"

# ⚠️ Guard: never touch a network model when no token is present.
if [[ -z "${OPENCODE_API_KEY:-}" ]]; then
  echo "generate-weekly: OPENCODE_API_KEY is not set — refusing to call any model." >&2
  echo "generate-weekly: set OPENCODE_API_KEY (repo secret) for weekly generation, or run workflow_dispatch." >&2
  exit 1
fi
if ! command -v opencode >/dev/null 2>&1; then
  echo "generate-weekly: opencode CLI not found (npm install -g opencode-ai@1.18.32)." >&2
  exit 1
fi

mkdir -p "$ROOT/out" "$WORK_DIR"
: > "$FEEDBACK_FILE"
printf '%s' '{"tokens":{"total":0,"input":0,"output":0,"reasoning":0},"cost":0}' > "$WORK_DIR/usage-total.json"

echo "[generate-weekly] slug=$SLUG max-iters=$MAX_ITERS"

# Gag-bank summary (freshness hint for the writer).
if [[ -s "$ROOT/out/gaglog.json" ]]; then
  GAG_SUMMARY="$(node --input-type=commonjs -e "
    const l = JSON.parse(require('fs').readFileSync('$ROOT/out/gaglog.json','utf8'));
    console.log('Prior gags: ' + l.length + '. Puzzle-hints: ' + l.slice(-4).map(e => e.key.slice(0,12)).join(', '));
  " 2>/dev/null || true)"
else
  GAG_SUMMARY="No prior gags in the bank."
fi

MANIFEST="$(cat "$ROOT/assets/manifest.json")"
WRITER_PERSONA="$(cat "$ROOT/.opencode/agent/writer.md")"
COMIC_BOOK="$(cat "$ROOT/library/comic-writing.mini.md")"
SCHEMA_BOOK="$(cat "$ROOT/library/panel-schema.mini.md")"
PREVIOUS_FEEDBACK="(none)"

PASSED=""
for ((iter = 1; iter <= MAX_ITERS; iter++)); do
  ITER_DIR="$WORK_DIR/attempt-$iter"
  mkdir -p "$ITER_DIR"
  echo "[generate-weekly] attempt $iter/$MAX_ITERS"

  PROMPT_FILE="$ITER_DIR/prompt.txt"
  RESPONSE_FILE="$ITER_DIR/response.txt"
  PANEL_FILE="$ITER_DIR/panel.json"

  cat > "$PROMPT_FILE" <<'PROMPT'
You are the ailbert comic writer. Produce a NEW 3-panel Dilbert-style gag and output it as a SINGLE JSON object only — no prose, no markdown fences, no explanations.

persona:
PROMPT
  echo "----" >> "$PROMPT_FILE"
  echo "$WRITER_PERSONA" >> "$PROMPT_FILE"
  cat >> "$PROMPT_FILE" <<'PROMPT'

comic-writing book (humor grammar, beats, topic bank):
PROMPT
  echo "----" >> "$PROMPT_FILE"
  echo "$COMIC_BOOK" >> "$PROMPT_FILE"
  cat >> "$PROMPT_FILE" <<'PROMPT'

panel-schema book (exact shape + coordinates + enumeration rules):
PROMPT
  echo "----" >> "$PROMPT_FILE"
  echo "$SCHEMA_BOOK" >> "$PROMPT_FILE"
  cat >> "$PROMPT_FILE" <<'PROMPT'

assets/manifest.json (THE anti-hallucination gate — enumerate ids/poses/expressions/backgrounds/styles ONLY from this list):
PROMPT
  echo "----" >> "$PROMPT_FILE"
  echo "$MANIFEST" >> "$PROMPT_FILE"
  cat >> "$PROMPT_FILE" <<'PROMPT'

target fixture slug: weekly-DATE
strip.date: DD (ISO YYYY-MM-DD, today's UTC date)

PROMPT
  echo "target fixture slug: $SLUG" >> "$PROMPT_FILE"
  echo "strip.date: $(date -u +%Y-%m-%d)" >> "$PROMPT_FILE"
  cat >> "$PROMPT_FILE" <<'PROMPT'

Freshness context:
PROMPT
  echo "$GAG_SUMMARY" >> "$PROMPT_FILE"
  cat >> "$PROMPT_FILE" <<PROMPT

Previous verify feedback (from out/verify.json, if the loop already failed):
$PREVIOUS_FEEDBACK

Respond with ONLY a valid JSON panel object:
{ "strip": { "title": "...", "date": "YYYY-MM-DD" },
  "panels": [ { "background": "...", "actors": [{ "id", "pose", "expression", "positionX", "positionY" }],
                "bubble": { "text", "targetX", "targetY", "style" } } ] }
PROMPT

  echo "[generate-weekly] invoking opencode CLI (opencode/big-pickle)..."
  set +e
  opencode run --model opencode/big-pickle --format json "$(cat "$PROMPT_FILE")" > "$RESPONSE_FILE" 2>> "$WORK_DIR/opencode.err"
  OC_EXIT=$?
  set -e
  if [[ $OC_EXIT -ne 0 ]]; then
    echo "[generate-weekly] opencode exit $OC_EXIT (see work/weekly/$SLUG/opencode.err)" >&2
    echo "opencode CLI exited $OC_EXIT" >> "$FEEDBACK_FILE"
    PREVIOUS_FEEDBACK="opencode CLI exited $OC_EXIT"
    continue
  fi

  node --input-type=commonjs -e "
    const fs = require('fs');
    fs.rmSync('$PANEL_FILE', { force: true });
    let text = '';
    let total = 0, input = 0, output = 0, reasoning = 0, cost = 0;
    for (const line of fs.readFileSync('$RESPONSE_FILE', 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      if (e && e.type === 'text' && e.part && e.part.type === 'text') text += e.part.text;
      if (e && e.type === 'step_finish' && e.part) {
        const t = e.part.tokens || {};
        total += t.total || 0;
        input += t.input || 0;
        output += t.output || 0;
        reasoning += t.reasoning || 0;
        cost += e.part.cost || 0;
      }
    }
    const usage = { tokens: { total, input, output, reasoning }, cost };
    fs.writeFileSync('$ITER_DIR/usage.json', JSON.stringify(usage, null, 2) + '\n');
    const totalPath = '$WORK_DIR/usage-total.json';
    let acc;
    try { acc = JSON.parse(fs.readFileSync(totalPath, 'utf8')); } catch { acc = null; }
    if (!acc || !acc.tokens) acc = { tokens: { total: 0, input: 0, output: 0, reasoning: 0 }, cost: 0 };
    acc.tokens.total += total;
    acc.tokens.input += input;
    acc.tokens.output += output;
    acc.tokens.reasoning += reasoning;
    acc.cost += cost;
    fs.writeFileSync(totalPath, JSON.stringify(acc, null, 2) + '\n');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) { console.error('no JSON object found'); process.exit(1); }
    let obj;
    try { obj = JSON.parse(text.slice(start, end + 1)); }
    catch (err) { console.error('JSON parse failed: ' + err.message); process.exit(1); }
    if (!obj.strip || !Array.isArray(obj.panels)) { console.error('not a panel object'); process.exit(1); }
    fs.writeFileSync('$PANEL_FILE', JSON.stringify(obj, null, 2) + '\n');
    console.log('parsed panel JSON (' + obj.panels.length + ' panels)');
  " && echo "parsed" > "$ITER_DIR/parsed.ok" || {
    echo "model output was not a valid panel JSON" >> "$FEEDBACK_FILE"
    PREVIOUS_FEEDBACK="The proposed panel JSON did not parse; return ONLY a JSON object (no fences/prose)."
    continue
  }
  [[ -s "$PANEL_FILE" ]] || { echo "empty panel.json" >> "$FEEDBACK_FILE"; continue; }

  echo "[generate-weekly] validating schema..."
  if ! node --input-type=commonjs -e "
    const fs = require('fs');
    const { validate } = await import('$ROOT/src/schema/validate.js');
    const panel = JSON.parse(fs.readFileSync('$PANEL_FILE','utf8'));
    const v = validate(panel);
    if (!v.ok) { console.error(v.errors.join('; ')); process.exit(1); }
    console.log('schema OK');
  " >> "$WORK_DIR/attempt-$iter/validate.log" 2>&1; then
    echo "schema errors: $(cat "$WORK_DIR/attempt-$iter/validate.log")" >> "$FEEDBACK_FILE"
    PREVIOUS_FEEDBACK="Schema errors: $(cat "$WORK_DIR/attempt-$iter/validate.log")"
    continue
  fi
  echo "schema: PASS"

  echo "[generate-weekly] rendering + verifying..."
  if node "$ROOT/src/renderer/render-strip.js" --panel "$PANEL_FILE" >/dev/null 2>> "$FEEDBACK_FILE" \
     && node "$ROOT/scripts/verify_strip.js" --panel "$PANEL_FILE" >> "$WORK_DIR/attempt-$iter/verify.log" 2>&1; then
    FIXTURE_DIR="$ROOT/fixtures/$SLUG"
    mkdir -p "$FIXTURE_DIR"
    cp "$PANEL_FILE" "$FIXTURE_DIR/panel.json"
    cp "$ROOT/out/strip.png" "$FIXTURE_DIR/strip.png"
    cp "$ROOT/out/panel-0.png" "$ROOT/out/panel-1.png" "$ROOT/out/panel-2.png" "$FIXTURE_DIR/"
    echo "[generate-weekly] PASS on attempt $iter/$MAX_ITERS"
    cat "$WORK_DIR/attempt-$iter/verify.log"

    node --input-type=commonjs -e "
      const fs = require('fs');
      const usage = JSON.parse(fs.readFileSync('$WORK_DIR/usage-total.json', 'utf8'));
      usage.attempts = $iter;
      fs.writeFileSync('$FIXTURE_DIR/usage.json', JSON.stringify(usage, null, 2) + '\n');
    "

    git config user.name "github-actions[bot]"
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
    git add "fixtures/$SLUG"
    git commit -m "weekly: add strip $SLUG"
    echo "[generate-weekly] committed fixtures/$SLUG"
    exit 0
  else
    if [[ ! -s "$WORK_DIR/attempt-$iter/verify.log" ]]; then
      echo "render or verify failed (see feedback)" >> "$FEEDBACK_FILE"
      PREVIOUS_FEEDBACK="The render/verify pipeline failed; see out/verify.json feedback below."
    else
      FEEDBACK="$(node --input-type=commonjs -e "console.log(JSON.parse(require('fs').readFileSync('$ROOT/out/verify.json','utf8')).feedback)")"
      echo "verify feedback: $FEEDBACK" >> "$FEEDBACK_FILE"
      PREVIOUS_FEEDBACK="$FEEDBACK"
      cat "$WORK_DIR/attempt-$iter/verify.log"
    fi
  fi
done

echo "[generate-weekly] exhausted $MAX_ITERS iterations without a PASS (exit 2)" >&2
>&2 cat "$FEEDBACK_FILE"
exit 2