# ailbert

**ailbert** is an AI-generated, Dilbert-style comic strip. A self-discovering loop
takes it from gag to finished PNG with no hard-coded jokes:

```
writer proposes gag + panel JSON ──► renderer materializes sketchy SVG/PNG
        ▲                                     │
        └──────── verify_strip.js scores, feeds feedback back ─┘
                        iterate ≤ N, then escalate
```

Everything is deterministic: the same panel JSON always renders to the
byte-identical PNG. All agentic work is pinned to the cloud model
`opencode/big-pickle`; no local model needed.

## Quickstart

```bash
npm install       # install pinned deps (jsdom, roughjs, @resvg/resvg-js)
npm run setup     # fetch vendored Patrick Hand font into assets/fonts/
npm run strip     # render the sample strip -> out/strip.png (max 1 iteration)
npm run loop      # run the full sample loop (render -> score -> iterate ≤ 3)
npm run site      # build the local gallery under site/
npm run test      # golden-determinism + verify on all committed panels
npm run lint      # syntax-check every .js file in src/ and scripts/
```

`npm run strip` writes `out/strip.svg` (rough.js sketchy SVG) and
`out/strip.png` (800px raster). `npm run loop` additionally runs the
scoring loop and prints the feedback from `out/verify.json`.

## How the loop works

1. The **writer** agent proposes a 3-panel gag as schema-valid panel JSON
   (`fixtures/sample/panel.json` is the reference).
2. The **renderer** materializes it: fixed 800×800 panels, % coordinates →
   px, stable seed from a hash of the panel JSON, vendored Patrick Hand font.
3. `scripts/verify_strip.js` scores it (structural / assets / geometry /
   text-fit / humor; weighted sum = 100, pass ≥ 80) and writes
   `out/verify.json` with actionable feedback.
4. Feedback goes back to the writer for the next attempt (≤ N iterations);
   if the loop never clears the gate, the writer escalates to the architect.

The shell loop driver `scripts/write-strip.sh` renders + scores deterministically
and prints feedback; the agentic revision happens outside the shell.

## GH Pages

The gallery is published at **https://nmwael.github.io/ailbert** by
`.github/workflows/pages.yaml`: on every push to `main` (or via
`workflow_dispatch`) it runs `npm ci`, fetches fonts, and `node
scripts/build-site.js` builds `site/index.html` + `site/strips.json` from the
committed fixtures, then deploys with `actions/deploy-pages`. The built
`site/` directory is gitignored; CI regenerates it from `fixtures/`.

## Repo guide

- **`library/`** — condensed reference books, one per agent role. Start at
  `library/README.md`.
- **`AGENTS.md`** — behavioral contract for the agents (HITL gate, loop
  contract, recursion prevention, verification protocol).
- **`assets/`** — the manifest-enumerated SVG universe; `assets/manifest.json`
  is the anti-hallucination hard gate for the writer.
- **`fixtures/`** — committed sample + golden strips (panel JSON + rendered
  PNG). The goldens are the determinism regression set.
- **`src/`** — schema validation and the deterministic renderer.

## License

MIT — see [LICENSE](LICENSE).