import { mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'fixtures');
const SITE = join(ROOT, 'site');

function renderForSite(panelPath, outDir) {
  mkdirSync(outDir, { recursive: true });
  const r = spawnSync('node', [join(ROOT, 'src', 'renderer', 'render-strip.js'), '--panel', panelPath], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(r.stdout || '');
    console.error(r.stderr || '');
    throw new Error(`render-strip failed for ${panelPath} (exit ${r.status})`);
  }
  copyFileSync(join(ROOT, 'out', 'strip.png'), join(outDir, 'strip.png'));
}

function main() {
  const dirs = readdirSync(FIXTURES).filter((d) => {
    const p = join(FIXTURES, d);
    return statSync(p).isDirectory() && exists(p, 'panel.json');
  }).sort();

  rmSync(SITE, { recursive: true, force: true });
  mkdirSync(join(SITE, 'strips'), { recursive: true });

  const strips = [];
  for (const slug of dirs) {
    const panelPath = join(FIXTURES, slug, 'panel.json');
    const panel = JSON.parse(readFileSync(panelPath, 'utf8'));
    const outDir = join(SITE, 'strips', slug);
    renderForSite(panelPath, outDir);
    strips.push({ slug, title: panel.strip.title, panels: panel.panels.length, path: `strips/${slug}/strip.png` });
  }

  let cards = '';
  for (const s of strips) {
    cards += `      <article class="card">
        <img src="${s.path}" alt="ailbert strip: ${esc(s.title)}" loading="lazy">
        <div class="meta">
          <h2>${esc(s.title)}</h2>
          <p>${s.panels} panels</p>
        </div>
      </article>\n`;
  }

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ailbert — AI-generated Dilbert-style strips</title>
  <style>
    :root { --ink:#111; --paper:#fdfdfd; --wash:#f2ede4; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--wash); color:var(--ink);
      font: 16px/1.5 Georgia, 'Times New Roman', serif; }
    header { text-align:center; padding:2.5rem 1rem 1rem; }
    header h1 { font-style:italic; font-size:2.4rem; margin:0; }
    header p { margin:.4rem auto 0; max-width:44rem; opacity:.8; }
    main { max-width:1320px; margin:0 auto; padding:1.5rem 1rem 3rem; display:grid;
      grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:1.5rem; }
    .card { background:var(--paper); border:1px solid rgba(17,17,17,.15);
      box-shadow:0 2px 8px rgba(0,0,0,.08); overflow:hidden; }
    .card img { display:block; width:100%; height:auto; border-bottom:1px solid rgba(17,17,17,.1); }
    .card .meta { padding:.8rem 1rem 1rem; }
    .card h2 { margin:0; font-size:1.15rem; }
    .card p { margin:.25rem 0 0; font-size:.85rem; opacity:.65; }
    footer { text-align:center; padding:1rem; opacity:.55; font-size:.85rem; }
  </style>
</head>
<body>
  <header>
    <h1>ailbert</h1>
    <p>AI-generated, Dilbert-style comic strips — proposed by a writer agent,
       materialized by a deterministic rough.js renderer, verified by a scorer.</p>
  </header>
  <main>
${cards}  </main>
  <footer>ailbert — MIT licensed. Dilbert-style homage; not affiliated with Scott Adams or the Dilbert franchise.</footer>
</body>
</html>
`;

  writeFileSync(join(SITE, 'index.html'), indexHtml);
  writeFileSync(join(SITE, 'strips.json'), JSON.stringify(strips, null, 2));
  console.log(`Built ${strips.length} strips to site/`);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function exists(base, name) {
  try {
    return readFileSync(join(base, name)).length > 0;
  } catch {
    return false;
  }
}

try {
  main();
} catch (e) {
  console.error(`build-site: ${e.message}`);
  process.exit(1);
}