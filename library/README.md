# library

Condensed reference books for the ailbert agents. Read your role's book(s)
before answering in your domain. Terse bullets, concrete examples, no filler.

## Role → book matrix

| Role | Books |
|------|-------|
| `writer` | `comic-writing.mini.md`, `panel-schema.mini.md` |
| `artist` | `svg-assets.mini.md` (+ style tokens from `rough-rendering.mini.md`) |
| `renderer` | `rough-rendering.mini.md`, `panel-schema.mini.md`, `svg-assets.mini.md` |
| `reviewer` | `verify-scoring.mini.md`, `panel-schema.mini.md` |
| architect / coder / researcher | whatever the task touches; same files |

## Layout

- `*.mini.md` — one condensed book per domain (6–8 sections each).
- `manifest.json` — machine-readable role → book mapping (the loader uses it).

## Sources / attribution

- **rough.js** — MIT. hachure/sketchy geometry (npm `roughjs`).
- **@resvg/resvg-js** — MPL-2.0. SVG → PNG rasterization.
- **Patrick Hand** — SIL OFL-1.1. Vendored handwriting font via
  `scripts/fetch-fonts.sh` (google/fonts raw source).
- **Humor grammar** — the 6-trigger model is based on Scott Adams' own stated
  triggers for Dilbert-style workplace humor (publicly stated; paraphrased
  here as a writing checklist, not quoted). ailbert is a parody homage;
  Dilbert is a trademark of its respective owner; no affiliation.
- **jsdom** — MIT (HTML/DOM environment for rough.svg headless).