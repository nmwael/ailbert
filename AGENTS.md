# Agent Behavior Contract (ailbert)

This repo is a human-in-the-loop (HITL) workflow. The loop that *owns* the comic
goes: **writer proposes panel JSON → renderer materializes → verify_strip.js
scores → feedback → writer iterates ≤ N → escalate on failure.**

All agents are pinned to the cloud model `opencode/big-pickle` (see
`opencode.json`). No local model, no API keys for third parties.

## ⚠️ HARD GATE: never skip the plan gate

**You MUST NOT create, edit, or modify any code files until the human has
explicitly approved an architect's plan.** Operational tasks (running commands,
reading files, rendering strips) are exempt. Everything else flows:
`architect plans → human approves → coder/implementer applies → reviewer audits`.

For the running *loop* the same gate applies to content: the writer proposes a
new gag, the renderer+verifier materialize and score it — the human/architect
approves before a new gag becomes a committed fixture.

## The Loop contract

1. **writer** reads `library/comic-writing.mini.md` + `library/panel-schema.mini.md`
   + `assets/manifest.json`; proposes a 3-panel gag as schema-valid JSON under
   `work/attempt-N/panel.json`. Enumerates ids/poses/expressions ONLY from the
   manifest — never invents assets.
2. **renderer** loads the panel + manifest, renders `out/strip.svg` +
   `out/strip.png` deterministically (stable seed ⇒ byte-identical PNG).
3. **reviewer** runs `scripts/verify_strip.js`; it scores (structural 20 /
   assets 25 / geometry 20 / text-fit 20 / humor 15; pass ≥ 80) and writes
   `out/verify.json`.
4. Feedback from `out/verify.json` is handed back to the writer for the next
   attempt, up to `--max-iters N`. If the loop never clears the gate, the writer
   reports the blocker to the architect and stops. **No self-looping.**
5. Every committed `fixtures/*` gag must carry a render-twice byte-identical
   PNG. `npm run test` enforces this.

## Roster

| Agent | Use for |
|-------|---------|
| `build` / `architect` / `coder` / `researcher` | built-in defaults; orchestrator, planner, implementer, explorer |
| `writer` | proposing gag + panel JSON (comic craft, manifest-bound) |
| `artist` | owns `assets/**` SVG universe + `assets/manifest.json` |
| `renderer` | deterministic SVG/PNG materialization of panel JSON |
| `reviewer` | verify-criteria audit gate for the loop |

## Rules

### Recursion prevention
- **Architect-bridge only:** specialists NEVER delegate to other specialists.
  Cross-specialist work is reported back to the `architect` (depth ≤ 2).
- A task is complete when the agent returns the requested data/code — not a
  "next step" hand-off to another agent.

### Mandatory questioning & HITL approval
- Clarifying ambiguity → use the `question` tool, not plain text.
- Plan approval / decisions → structured `question` with options.
- When a plan awaits approval, state: **"I am waiting for approval."**

### Tools & package gate
- **NEVER npm-install missing tools ad hoc.** Required tools live as pinned dev
  deps or devcontainer features. Missing a tool? Report exactly what you need to
  the architect; it lands behind the normal human-approval gate.
- Fonts are fetched ONLY by `scripts/fetch-fonts.sh` into `assets/fonts/`
  (gitignored, vendored per install).
- Scratch space lives under `work/` (gitignored).

### Verification protocol
- Before any task is marked complete, the architect verifies the artifacts on
  the filesystem (`git status` / read) against the agent's report.
- No code is 'complete' without a reviewer pass.

## Conventions

- **Model pin sync:** `opencode/big-pickle` everywhere (root `model`,
  `small_model`, and every specialist in `opencode.json`). Keep them in sync.
- **Determinism mandate:** same panel JSON ⇒ same SVG string ⇒ same PNG bytes.
  No `Date`, no `Math.random` in the render/verify pipeline (stable seed from a
  hash of the panel JSON).
- **`assets/manifest.json` is the anti-hallucination gate.** The writer cannot
  reference an asset that is not enumerated; unknown ids hard-fail validation.
- **Fixtures are committed.** `fixtures/*/panel.json` + `fixtures/*/strip.png`
  ship in git (the `.png` is the only committed binary).
- **`assets/fonts/` is gitignored.** Rebuild it with `bash scripts/fetch-fonts.sh`.
- **`site/` is built in CI, never committed.** GH Pages regenerates it from
  `fixtures/` on every push to `main`.
- All coordinates in panel JSON are **% of an 800×800 panel, y-down, 0–100**.
- `out/` and `work/` are runtime artifacts, never committed.