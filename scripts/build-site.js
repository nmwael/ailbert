import { mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'fixtures');
const SITE = join(ROOT, 'site');

const PANEL_NAMES = ['panel-0.png', 'panel-1.png', 'panel-2.png'];

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
  for (const name of PANEL_NAMES) {
    copyFileSync(join(ROOT, 'out', name), join(outDir, name));
  }
}

function stripDate(panel, slug) {
  return typeof panel.strip?.date === 'string' && panel.strip.date ? panel.strip.date : slug;
}

function formatEU(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function panelBlock(strip, s) {
  const images = s.panels.map(
    (p) => `      <img class="panel" src="${p.src}" alt="${esc(strip.title)} panel ${p.index + 1}" loading="lazy">`
  ).join('\n');
  const eu = formatEU(strip.date);
  const dateLine = eu ? `    <p class="date">${esc(eu)}</p>\n` : '';
  const usageNote = s.usage
    ? `    <p class="usage-note">generated in ${s.usage.attempts} attempt${s.usage.attempts === 1 ? '' : 's'} · ${s.usage.tokens.total.toLocaleString('en-US')} tokens · $${s.usage.cost.toFixed(4)}</p>\n`
    : '';
  return `  <article class="strip">
    <header>
      <h2>${esc(strip.title)}</h2>
${dateLine}    </header>
    <div class="panels">
${images}
    </div>
${usageNote}  </article>`;
}

function page(title, intro, navLink, stripsHtml, strips) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { --ink:#111; --paper:#fdfdfd; --wash:#f2ede4; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--wash); color:var(--ink);
      font: 16px/1.5 Georgia, 'Times New Roman', serif; }
    header.site { text-align:center; padding:2.5rem 1rem 1rem; }
    header.site h1 { font-style:italic; font-size:2.4rem; margin:0; }
    header.site p { margin:.4rem auto 0; max-width:44rem; opacity:.8; }
    main { max-width:1200px; margin:0 auto; padding:1.5rem 1rem 3rem; }
    article.strip { background:var(--paper); border:1px solid rgba(17,17,17,.15);
      box-shadow:0 2px 8px rgba(0,0,0,.08); margin-bottom:2.5rem; overflow:hidden; }
    article.strip header { padding:1rem 1.5rem .6rem; border-bottom:1px solid rgba(17,17,17,.1); }
    article.strip h2 { margin:0; font-size:1.3rem; }
    article.strip .date { margin:.15rem 0 0; font-size:.85rem; opacity:.6; }
    article.strip .panels { display:flex; flex-wrap:nowrap; gap:8px; }
    article.strip .panels img.panel { display:block; flex:1 1 0; min-width:0; width:100%; height:auto; }
    article.strip .usage-note { margin:0; padding:.4rem 1.5rem .8rem; font-size:.8rem; opacity:.6; text-align:right; }
    .bottom-nav { text-align:center; padding:1.5rem 0 .5rem; font-size:1.05rem; }
    .bottom-nav a { color:var(--ink); text-decoration:underline; }
    @media (max-width:640px) {
      article.strip .panels { flex-wrap:wrap; }
      article.strip .panels img.panel { flex:1 1 100%; }
    }
    footer { text-align:center; padding:1rem; opacity:.55; font-size:.85rem; }
  </style>
</head>
<body>
  <header class="site">
    <h1>ailbert</h1>
    <p>${intro}</p>
  </header>
  <main>
${stripsHtml}    <p class="bottom-nav">${navLink}</p>
  </main>
  <footer>ailbert — MIT licensed. New strips every week from the weekly workflow.
    Dilbert-style homage; not affiliated with Scott Adams or the Dilbert franchise.<br>
    Example use of the <a href="https://github.com/nmwael/agentic-devcontainer-feature" target="_blank" rel="noopener">agentic devcontainer feature</a> agentic pipeline.</footer>
</body>
</html>
`;
}

function main() {
  const dirs = readdirSync(FIXTURES).filter((d) => {
    const p = join(FIXTURES, d);
    return statSync(p).isDirectory() && exists(p, 'panel.json');
  });

  const strips = [];
  for (const slug of dirs) {
    const panelPath = join(FIXTURES, slug, 'panel.json');
    const panel = JSON.parse(readFileSync(panelPath, 'utf8'));
    const date = stripDate(panel, slug);
    let usage;
    if (exists(FIXTURES, `${slug}/usage.json`)) {
      usage = JSON.parse(readFileSync(join(FIXTURES, slug, 'usage.json'), 'utf8'));
    }
    strips.push({
      slug,
      title: panel.strip.title,
      date,
      usage,
      panels: PANEL_NAMES.map((name, i) => ({ src: `strips/${slug}/${name}`, index: i })),
      pathCombined: `strips/${slug}/strip.png`,
    });
  }

  strips.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug < b.slug ? 1 : -1));

  const latest = strips.slice(0, 3);
  const older = strips.slice(3);

  rmSync(SITE, { recursive: true, force: true });
  mkdirSync(join(SITE, 'strips'), { recursive: true });
  for (const strip of strips) {
    const panelPath = join(FIXTURES, strip.slug, 'panel.json');
    renderForSite(panelPath, join(SITE, 'strips', strip.slug));
  }

  const archiveCount = older.length;
  const indexBody = latest.map((s) => panelBlock(s, s)).join('\n');
  const archiveBody = older.map((s) => panelBlock(s, s)).join('\n');

  const intro = 'AI-generated, Dilbert-style comic strips — proposed by a writer agent, materialized by a deterministic rough.js renderer, verified by a scorer. <br><br>This site demonstrates the agentic pipeline from the <a href="https://github.com/nmwael/agentic-devcontainer-feature" target="_blank" rel="noopener">agentic devcontainer feature</a>: writer → reviewer → renderer roles are orchestrated via Opencode, with HITL-approved plans, deterministic rendering, and weekly GH Actions generation. New strips every week.';

  writeFileSync(join(SITE, 'index.html'), page(
    'ailbert — AI-generated Dilbert-style strips',
    intro,
    '<a href="archive.html">Archive &rarr;</a>',
    indexBody,
    latest
  ));
  writeFileSync(join(SITE, 'archive.html'), page(
    'ailbert — Archive',
    archiveCount
      ? `Older strips (${archiveCount}) — the newest ${latest.length} are on the front page.`
      : 'No archived strips yet — check back after the weekly workflow runs.',
    '<a href="index.html">&larr; Latest</a>',
    archiveBody,
    older
  ));
  writeFileSync(join(SITE, 'strips.json'), JSON.stringify(strips, null, 2));
  console.log(`Built ${strips.length} strips to site/ (latest ${latest.length}, archive ${archiveCount})`);
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