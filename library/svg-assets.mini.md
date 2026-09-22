# svg-assets (mini)

Contract for the visual universe. Read by **artist**, consumed by **renderer**.

## 1. Directory layout

```
assets/actors/<id>/pose-<pose>/expr-<expression>.svg
assets/backgrounds/<scene>.svg
assets/manifest.json
```
- ids: `worker`, `boss`; poses: worker `sitting|standing`, boss `standing`;
  expressions: worker `stressed|neutral`, boss `neutral`; scene: `office`.

## 2. SVG contract

- `viewBox="0 0 100 100"` — coordinates are % of the 800×800 panel when placed.
- **Self-contained:** no `<script>`, no external refs, no `<image>` to URLs, no
  gradients/effects. Must parse standalone (jsdom-parse it before hand-off).
- Actors MUST contain registration markers:
  - `<g id="anchor-feet">` — placement origin (feet center).
  - `<g id="anchor-mouth">` — bubble-tail target.
  Both are empty groups positioned at the right coords (data-attrs optional).

## 3. Style tokens

- ink `#111`, paper `#fdfdfd`, skin `#f4c2a0`.
- Black hachured / hand-drawn linework only. **No gradients, no blur, no
  drop-shadows.** Match rough.js sketchy energy.

## 4. Canonical pose/expression sets

| id | poses | expressions |
|---|---|---|
| worker | sitting, standing | stressed, neutral |
| boss | standing | neutral |

Anything beyond this must be added to the manifest (with the SVG) by the artist,
with architect approval.

## 5. manifest.json contract

```json
{ "actors": { "worker": {"poses":[...], "expressions":[...]}, "boss": {...} },
  "backgrounds": ["office"],
  "bubbleStyles": ["speech","thought","shout","whisper"] }
```
- The manifest is the **anti-hallucination hard gate**: the writer may only name
  what it lists; `validate()` **hard-fails** on any unknown id/pose/expression
  /background/style. Never let an unlisted asset reach the renderer.

## 6. Consumption rules

- Fixed z-order: background → actors → bubbles.
- Placement: `anchor-feet` at the actor's `positionX/Y` (% → px).
- Bubble tails attach to `anchor-mouth`.
- Bubbles are drawn AFTER actors; backgrounds first.