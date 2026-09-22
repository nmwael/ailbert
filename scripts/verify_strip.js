import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { validate } from '../src/schema/validate.js';
import { wrapLines, bubbleSize, TEXT, stableSeed } from '../src/renderer/compose.js';
import { loadManifest } from '../src/schema/manifest-loader.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');

const PANEL_PX = 800;
const TAIL_MAX_PX = 320;
const BOX_HALF_W = 16;
const BOX_TOP_MOUTH_OFFSET = 25;
const BOX_BOTTOM_OFFSET = 3;

const IMPORTANCE = /strategy|enterprise|critical|mission|legacy|roadmap|production|roi\b|compliance|deadline|kpi\b|metrics|budget|ai\b|llm\b|algorithm|automat|agentic|hallucinat/i;
const TRIVIAL = /standup|meeting|commit|email|paperclip|screenshot|button|slack|tps\b|sticky|font|outage|anim|badge|emoji|stroke width/i;
const PLATITUDE = /synerg|leverage|align|source of truth|optimiz|bandwidth|proactive|best practice|low-hanging|move fast|holistic|ecosystem|onboard|deliverable|value-add|reimagin|streamline/i;
const INAPPROPRIATE = /hallucinat|reboot|restart|reinstall|outsourc|more meetings|another meeting|workshop|offsite|reorg|standup about|ai now runs|llm wrote|llm writes|ai runs/i;
const UNSEEN = /nobody spoke|everyone else|the room went|hr laughed|they all turned|his boss/i;
const BLOCKLIST = /as an ai|in today's|think outside the box|game changer|single blocklist|paradigm shift|move fast and break things|circle back to circle back/i;
const PROFANITY = /fuck|shit\b|bitch|dammit|asshole/i;

function anchorOf(id, def) {
  let src;
  try {
    src = readFileSync(id, 'utf8');
  } catch {
    return def.fallback;
  }
  const doc = new JSDOM(src, { contentType: 'text/xml' }).window.document;
  const el = doc.getElementById(def.name);
  if (!el) return def.fallback;
  const x = Number(el.getAttribute('data-x'));
  const y = Number(el.getAttribute('data-y'));
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  return def.fallback;
}

function actorMeta(id, pose, expr, root) {
  const path = join(root, 'assets', 'actors', id, `pose-${pose}`, `expr-${expr}.svg`);
  const feet = anchorOf(path, { name: 'anchor-feet', fallback: { x: 50, y: 92 } });
  const mouth = anchorOf(path, { name: 'anchor-mouth', fallback: { x: 50, y: 50 } });
  return { feet, mouth };
}

function tokens(texts) {
  const set = new Set();
  const s = texts.join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const stop = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'it', 'is', 'our', 'we', 'now', 'its', 'was']);
  for (const w of s) if (!stop.has(w)) set.add(w);
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--panel') args.panel = argv[i + 1];
  }
  return args;
}

function inside(v, lo, hi) { return v >= lo && v <= hi; }

function actorBox(a) {
  return {
    minX: a.positionX - BOX_HALF_W,
    maxX: a.positionX + BOX_HALF_W,
    minY: a.positionY + (a._mouth.y - BOX_TOP_MOUTH_OFFSET - a._feet.y),
    maxY: a.positionY + BOX_BOTTOM_OFFSET,
  };
}

function boxesOverlap(b1, b2) {
  return b1.minX < b2.maxX && b1.maxX > b2.minX && b1.minY < b2.maxY && b1.maxY > b2.minY;
}

function ellipseEdge(cx, cy, rx, ry, dx, dy) {
  const adx = Math.abs(dx) < 1e-6 ? 1e-6 : dx;
  const ady = Math.abs(dy) < 1e-6 ? 1e-6 : dy;
  const t = 1 / Math.hypot(adx / rx, ady / ry);
  return { x: cx + adx * t, y: cy + ady * t };
}

function rectEdge(cx, cy, hw, hh, dx, dy) {
  const adx = Math.abs(dx) < 1e-6 ? 1e-6 : dx;
  const ady = Math.abs(dy) < 1e-6 ? 1e-6 : dy;
  const t = Math.min(hw / Math.abs(adx), hh / Math.abs(ady));
  return { x: cx + Math.sign(adx) * t * Math.abs(adx), y: cy + Math.sign(ady) * t * Math.abs(ady) };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const panelPath = args.panel || join(ROOT, 'fixtures', 'sample', 'panel.json');
  mkdirSync(OUT, { recursive: true });

  const panel = JSON.parse(readFileSync(panelPath, 'utf8'));
  const man = loadManifest(join(ROOT, 'assets', 'manifest.json'));
  const v = validate(panel, man);

  const textAll = panel.panels.map((p) => p.bubble?.text || '').filter(Boolean);
  const p1Text = panel.panels[0]?.bubble?.text || '';
  const p3Text = panel.panels[2]?.bubble?.text || '';

  /* structural 20 */
  const structuralChecks = [];

  structuralChecks.push(Boolean(panel.strip && typeof panel.strip.title === 'string' && panel.strip.title.trim()));
  structuralChecks.push(Array.isArray(panel.panels) && panel.panels.length === 3);
  for (const p of panel.panels || []) {
    p.actors.forEach((a) => {
      structuralChecks.push(typeof a.positionX === 'number' && inside(a.positionX, 0, 100));
      structuralChecks.push(typeof a.positionY === 'number' && inside(a.positionY, 0, 100));
    });
    if (p.bubble) {
      structuralChecks.push(typeof p.bubble.text === 'string' && p.bubble.text.length >= 1 && p.bubble.text.length <= 90);
      structuralChecks.push(typeof p.bubble.targetX === 'number' && inside(p.bubble.targetX, 0, 100));
      structuralChecks.push(typeof p.bubble.targetY === 'number' && inside(p.bubble.targetY, 0, 100));
    }
  }
  const structural = Math.round(20 * (structuralChecks.filter(Boolean).length / Math.max(1, structuralChecks.length)));

  /* assets 25 — hard fail on any unknown */
  const assetChecks = [];
  let hardUnknown = false;
  for (const p of panel.panels || []) {
    assetChecks.push((man.backgrounds || []).includes(p.background));
    for (const a of p.actors || []) {
      const idOk = Boolean(man.actors?.[a.id] && a.pose && a.expression
        && man.actors[a.id].poses.includes(a.pose) && man.actors[a.id].expressions.includes(a.expression));
      if (!idOk) hardUnknown = true;
      assetChecks.push(idOk);
    }
    if (p.bubble) assetChecks.push((man.bubbleStyles || []).includes(p.bubble.style));
  }
  const assets = hardUnknown ? 0 : Math.round(25 * (assetChecks.filter(Boolean).length / Math.max(1, assetChecks.length)));

  /* geometry 20 (with text-derived bubble size from text-fit model) */
  const geoChecks = [];
  const anchors = {};
  for (const p of panel.panels || []) {
    for (const a of p.actors || []) {
      const meta = actorMeta(a.id, a.pose, a.expression, ROOT);
      a._feet = meta.feet;
      a._mouth = meta.mouth;
      a._box = actorBox(a);
    }
    for (const a of p.actors || []) {
      geoChecks.push(a._box.minY >= 0 && a._box.maxX <= 100 && a._box.maxY <= 100);
    }
    if (p.bubble) {
      const { text } = p.bubble;
      const size = bubbleSize(text);
      const w = size.w / 8;
      const h = size.h / 8;
      const bb = {
        minX: p.bubble.targetX - w / 2,
        maxX: p.bubble.targetX + w / 2,
        minY: p.bubble.targetY - h / 2,
        maxY: p.bubble.targetY + h / 2,
      };
      const speaker = p.actors[0];
      let mouthPx = { x: 0, y: 0 };
      if (speaker) {
        mouthPx = {
          x: (speaker.positionX + (speaker._mouth.x - speaker._feet.x)) * 8,
          y: (speaker.positionY + (speaker._mouth.y - speaker._feet.y)) * 8,
        };
      }
      geoChecks.push(!p.actors.some((a) => boxesOverlap(a._box, bb)));
      geoChecks.push(inside(mouthPx.x, 0, PANEL_PX) && inside(mouthPx.y, 0, PANEL_PX));
      const hw = (w / 2) * 8;
      const hh = (h / 2) * 8;
      const cxp = p.bubble.targetX * 8;
      const cyp = p.bubble.targetY * 8;
      let dx = mouthPx.x - cxp;
      let dy = mouthPx.y - cyp;
      if (Math.hypot(dx, dy) < 1e-6) dx = 1;
      const edge = p.bubble.style === 'shout' ? rectEdge(cxp, cyp, hw, hh, dx, dy) : ellipseEdge(cxp, cyp, hw, hh, dx, dy);
      const tailLen = Math.hypot(mouthPx.x - edge.x, mouthPx.y - edge.y);
      geoChecks.push(tailLen <= TAIL_MAX_PX);
    }
  }
  const geometry = Math.round(20 * (geoChecks.filter(Boolean).length / Math.max(1, geoChecks.length)));
  void anchors;
  void textAll;

  /* text-fit 20 */
  const fitChecks = [];
  for (const p of panel.panels || []) {
    if (p.bubble) {
      const size = bubbleSize(p.bubble.text);
      const w = size.w / 8;
      const h = size.h / 8;
      fitChecks.push(p.bubble.targetX - w / 2 >= 0 && p.bubble.targetX + w / 2 <= 100);
      fitChecks.push(p.bubble.targetY - h / 2 >= 0 && p.bubble.targetY + h / 2 <= 100);
      fitChecks.push(size.w <= TEXT.MAX_W);
      fitChecks.push(size.lines.every((l) => l.length <= TEXT.MAX_CHARS));
    }
  }
  const textFit = Math.round(20 * (fitChecks.filter(Boolean).length / Math.max(1, fitChecks.length)));

  /* humor 15 */
  const all = textAll.join(' ');
  let triggers = 0;
  if (IMPORTANCE.test(all) && TRIVIAL.test(all)) triggers++;
  if (PLATITUDE.test(all)) triggers++;
  if (INAPPROPRIATE.test(all)) triggers++;
  if (UNSEEN.test(all)) triggers++;
  const base = 5 * Math.min(2, triggers);
  let humor = base;

  const bl = BLOCKLIST.test(all) || PROFANITY.test(all);
  if (!bl) humor += 5;

  const recapJ = jaccard(tokens([p3Text]), tokens([p1Text]));
  if (recapJ >= 0.5) humor -= 7;

  const gagPath = join(OUT, 'gaglog.json');
  let gaglog = [];
  if (existsSync(gagPath)) gaglog = JSON.parse(readFileSync(gagPath, 'utf8'));
  const key = createHash('sha256').update(JSON.stringify(panel)).digest('hex');
  const p3tok = tokens([p3Text]);
  let nearDup = false;
  let dupWith = null;
  for (const e of gaglog) {
    if (e.key === key) continue;
    if (jaccard(p3tok, new Set(e.tokens)) >= 0.55) { nearDup = true; dupWith = e.key; }
  }
  if (nearDup) humor -= 7;

  humor = Math.max(0, Math.min(15, humor));
  void wrapLines; void stableSeed;

  const gaglogNext = gaglog.filter((e) => e.key !== key);
  gaglogNext.push({ key, tokens: Array.from(p3tok) });
  writeFileSync(gagPath, JSON.stringify(gaglogNext, null, 2));

  /* aggregate */
  const total = structural + assets + geometry + textFit + humor;
  const passed = total >= 80 && v.ok !== false && !hardUnknown;

  const bits = [];
  if (structural < 20) bits.push(`structural ${structural}/20 (check: panel count, title, positions, bubble ranges)`);
  if (assets < 25) bits.push(`assets ${assets}/25 (manifest gate: unknown id/pose/expression/background/style)`);
  if (geometry < 20) bits.push(`geometry ${geometry}/20 (bubble/actor overlap, mouth placement, tail length)`);
  if (textFit < 20) bits.push(`text-fit ${textFit}/20 (bubble sized from text must fit the panel)`);
  if (humor < 15) bits.push(`humor ${humor}/15 (fewer than 2 Adams triggers, cliché blocklist, or near-duplicate gag)`);
  if (recapJ >= 0.5) bits.push(`punchline restates panel 1 (jaccard ${recapJ.toFixed(2)} ≥ 0.5) — vary the ending`);
  if (nearDup) bits.push(`near-duplicate of a gagbank entry (${dupWith}) — freshen the punchline`);
  if (!v.ok) { bits.unshift(`schema: ${v.errors.join('; ')}`); }
  const feedback = passed
    ? `PASS ${total}/100 — structural ${structural}/20, assets ${assets}/25, geometry ${geometry}/20, text-fit ${textFit}/20, humor ${humor}/15.`
    : `FAIL ${total}/100 — ${bits.join('; ')}.`;

  const result = {
    total,
    categories: { structural, assets, geometry, 'text-fit': textFit, humor },
    passed,
    feedback,
  };
  writeFileSync(join(OUT, 'verify.json'), JSON.stringify(result, null, 2));
  console.log(`verify_strip: ${passed ? 'PASS' : 'FAIL'} total=${total}/100 ${panelPath}`);

  if (passed) return 0;
  console.log(feedback);
  return 1;
}

process.exit(main());