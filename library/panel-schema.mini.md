# panel-schema (mini) — v0.1

Contract for panel JSON. Read by writer, renderer, reviewer.

## Shape

```json
{
  "strip": { "title": "string" },
  "panels": [ /* EXACTLY 3 objects */ ],
  "panels[].background": "office",
  "panels[].actors": [ { "id", "pose", "expression", "positionX", "positionY" } ],
  "panels[].bubble": { "text", "targetX", "targetY", "style" }
}
```

## Coordinates

- All numeric positions are **% of an 800×800 panel**, **y-down**, range
  **0–100**. `positionX/Y` places the actor's feet-anchor; bubble
  `targetX/Y` places the bubble center.

## Enumeration rules (anti-hallucination)

- `background` ∈ `assets/manifest.json.backgrounds`.
- Each actor `id`/`pose`/`expression` MUST exist in the manifest.
- At most **1 bubble** per panel; `style` ∈ manifest `bubbleStyles`.
- `bubble.text` non-empty, **≤ 90 chars**.
- Unknown id / unknown style / wrong type / out-of-range number ⇒ **reject**
  (never normalize silently).

## Validation matrix

| field | rule |
|---|---|
| strip.title | string, required |
| panels | array, length === 3 |
| panels[].background | known id |
| actors[].id/pose/expression | known triple in manifest |
| positionX/Y | number 0–100 |
| bubble | optional; ≤1 |
| bubble.text | string, 1–90 |
| bubble.targetX/Y | number 0–100 |
| bubble.style | enum |
| anything unknown | hard fail with precise reason |

`validate(panel)` → `{ ok: boolean, errors: string[] }`.

## Extensibility

New scenes/poses/expressions are added to **the manifest + SVGs** (artist
scope), NOT by changing this schema. Schema changes require architect plan +
human approval.

## Example — good

```json
{
  "strip": { "title": "Sprint Review" },
  "panels": [
    { "background": "office",
      "actors": [ { "id": "worker", "pose": "sitting", "expression": "stressed", "positionX": 40, "positionY": 78 } ],
      "bubble": { "text": "The AI replaced my busywork with reviewing its busywork.", "targetX": 62, "targetY": 28, "style": "speech" } }
  ]
}
```
*(panels 2 & 3 omitted for brevity — a real strip has 3.)*

## Example — bad

```json
{
  "strip": { "title": "" },
  "panels": [ { "background": "beach",
    "actors": [ { "id": "cto", "pose": "flying", "expression": "smug", "positionX": 150 } ],
    "bubble": { "text": "...", "targetX": 50, "targetY": 50, "style": "narration" } } ]
}
```
→ unknown background, unknown id/pose/expression, positionX out of range,
too few panels, unknown style.