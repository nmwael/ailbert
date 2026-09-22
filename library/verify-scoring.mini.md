# verify-scoring (mini)

Scoring contract for `scripts/verify_strip.js` and the **reviewer** audit.

## 1. Weights (sum = 100; pass ≥ 80)

| category | weight | checks |
|---|---|---|
| structural | **20** | schema validity, exactly 3 panels, required fields/ranges |
| assets | **25** | every actor id/pose/expression in manifest; no unknown asset |
| geometry | **20** | bubble fully inside panel; tail within mouth-anchor radius; no actor/bubble overlap |
| text-fit | **20** | charcount-width model vs bubble box |
| humor | **15** | heuristics (below) |

## 2. Structural

`validate()` must be clean: 3 panels, title present, numbers 0–100, ≤1 bubble
per panel, text ≤ 90, style enum.

## 3. Assets

Every `id/pose/expression` and every `background` must resolve through the
manifest gate. One unknown id ⇒ assets category = 0 (and `ok:false`).

## 4. Geometry

- Bubble body rect/ellipse fully inside [0,100]² (%-space).
- Tail endpoint within a small radius of the actor's `anchor-mouth`.
- Actor body boxes vs bubble box must not overlap (placement sanity).

## 5. Text-fit

Simple model: width ≈ `0.55 * fontSize * textLength` px vs bubble width —
estimate and flag text that overflows the drawn bubble.

## 6. Humor heuristics (deterministic, no LLM)

- Blocklist clichés ("As an AI", "In today's fast-paced world"...).
- Punchline ≠ recap of panel 1 (token overlap cap).
- ≥1 two-trigger pair present (importance/triviality + platitudes, etc.).
- Profanity / meanspirited-real-people filter.
- **Gag-bank freshness:** Jaccard similarity of panel-3 tokens vs
  `out/gaglog.json` history; near-duplicate ⇒ flagged, logged.

## 7. Output

```json
{ "total": 0-100,
  "categories": { "structural": …, "assets": …, "geometry": …,
                  "text-fit": …, "humor": … },
  "passed": false,
  "feedback": "precise, actionable sentence(s) for the writer" }
```
- Exit **0** on pass (≥80), **1** on fail.
- Fully deterministic: no LLM calls, no Date/random (fixture-derived seed).
- Feedback contract: name the failing category + the fix. It is fed back to the
  writer's next attempt.

## 8. Golden regression

- `fixtures/golden-1/` + `fixtures/golden-2/` are committed with their PNGs.
- Render-twice ⇒ identical sha256; scores stable across runs.
  `npm run test` enforces this.