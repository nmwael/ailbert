# rough-rendering (mini)

Condensed reference for the **renderer** (and anyone touching SVG output).

## 1. Headless constraints

- Node **ESM** (`"type": "module"`), import `rough` normally.
- **jsdom@24.1.3 is PINNED** — latest jsdom breaks under CJS; 24.x is the
  verified combo. Do not bump casually.
- Rasterize with `@resvg/resvg-js` (`fitTo width 800`).

## 2. rough.js API surface

```js
import rough from 'roughjs';
const gen = rough.svg(svgRoot, { options });
gen.line / .rectangle / .ellipse / .circle / .polygon /
    .linearPath / .arc / .curve / .path   // each returns an <g>
```
Primitive opts: `{ roughness, bowing, seed, stroke, strokeWidth, fill, fillStyle,
fillWeight, hachureAngle, hachureGap, disableMultiStroke, simplification }`.

## 3. Options table (style tokens)

| opt | value | note |
|---|---|---|
| roughness | ~1.2 | wobble; higher = messier |
| bowing | ~1 | line bow |
| strokeWidth | ~2 | ink weight |
| seed | int | **fixed** per panel — determinism lever |
| fillStyle | `hachure` (default), also solid/zigzag/cross-hatch/dots/dashed/zigzag-line | bubble fill |
| fillWeight | ~2 | hachure stroke |
| hachureGap | ~4 | density |
| disableMultiStroke | true | cleaner, steadier output |

## 4. Panel composition

- One panel = 800×800; strip = 3 panels side-by-side + gutters + title.
- Coordinates in JSON are **% of panel, y-down, 0–100** → `px = pct * 8`.
- Z-order (fixed): background < actors < bubbles.

## 5. Bubble primitive recipe (hand-rolled)

- **comical-js is a PHANTOM package — 404 on npm. NEVER use it.**
- **Every bubble BODY is SOLID fill** (`#fdfdfd`, `fillStyle: 'solid'`) with the
  ink `#111` rough outline — text must sit on opaque paper, never hachure.
  Style only changes the outline/body shape: speech = solid ellipse; thought =
  solid dashed ellipse + cloud dots; shout = solid rectangle; whisper = solid
  ellipse with dashed ink outline.
- Tail = polygon from the body **EDGE point nearest the speaker** to the actor's
  **mouth anchor**; clamp body inside panel; switch attach side near edges.
- Z-order: background < actors < **bubble-body-fill** < bubble-text
  (`src/renderer/rough-bubble.js` returns shapes; the compose layer appends
  bubble body first, then the `<text>` group).

## 6. Text + font

- `<text>` + resvg `fontFiles` pointing at vendored Patrick Hand
  (`assets/fonts/PatrickHand-Regular.ttf`), `loadSystemFonts: false`.
- The container has **no system fonts** — fontFiles is mandatory, not optional.

## 7. Determinism rule

- `seed = sha256(JSON.stringify(panel))` truncated to 32-bit. Fixed seed ⇒
  byte-identical SVG ⇒ byte-identical PNG. No Date/random in output.
- **jsdom-free fallback:** `rough.generator()` produces shape objects; serialize
  with an op→path writer if you must render outside a DOM.