import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import rough from 'roughjs';
import { drawBubble } from './rough-bubble.js';
import { loadManifest } from '../schema/manifest-loader.js';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SVG_NS = 'http://www.w3.org/2000/svg';

export const PANEL = 800;
export const GUTTER = 40;
export const MARGIN = 40;
export const TITLE_AREA = 80;
export const STRIP_W = PANEL * 3 + GUTTER * 2 + MARGIN * 2;
export const STRIP_H = TITLE_AREA + PANEL + MARGIN;

export const TEXT = {
  FONT: 30,
  CHAR_W: 16,
  LINE_H: 38,
  PAD_X: 48,
  PAD_Y: 36,
  MAX_CHARS: 36,
  MAX_W: 760,
};

export function wrapLines(text, maxChars = TEXT.MAX_CHARS) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    let word = w;
    while (word.length > maxChars) {
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    const cand = cur ? `${cur} ${word}` : word;
    if (cand.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = cand;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function bubbleSize(text) {
  const lines = wrapLines(text);
  const longest = Math.max(...lines.map((l) => l.length));
  return {
    lines,
    w: Math.min(TEXT.MAX_W, longest * TEXT.CHAR_W + TEXT.PAD_X),
    h: Math.min(TEXT.MAX_W, lines.length * TEXT.LINE_H + TEXT.PAD_Y),
  };
}

export function stableSeed(panel) {
  return createHash('sha256').update(JSON.stringify(panel)).digest().readUInt32BE(0);
}

export function resolveManifest() {
  return loadManifest(join(HERE, 'assets', 'manifest.json'));
}

function importedSvgNodes(dom, path) {
  const src = readFileSync(path, 'utf8');
  const doc = new JSDOM(src, { contentType: 'text/xml' }).window.document;
  const root = doc.documentElement;
  const nodes = [];
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === 1) nodes.push(child);
  }
  return { nodes, doc };
}

function readAnchors(xmlDoc) {
  const pick = (id, defX, defY) => {
    const el = xmlDoc.getElementById(id);
    if (!el) return { x: defX, y: defY };
    const dx = Number(el.getAttribute('data-x'));
    const dy = Number(el.getAttribute('data-y'));
    if (Number.isFinite(dx) && Number.isFinite(dy)) return { x: dx, y: dy };
    return { x: defX, y: defY };
  };
  return { feet: pick('anchor-feet', 50, 92), mouth: pick('anchor-mouth', 50, 50) };
}

function actorSvgPath(id, pose, expression) {
  return join(HERE, 'assets', 'actors', id, `pose-${pose}`, `expr-${expression}.svg`);
}

export function renderStrip(panel, { assetsDir = join(HERE, 'assets'), fonts = {} } = {}) {
  const man = resolveManifest();
  const dom = new JSDOM('<!DOCTYPE html>', { pretendToBeVisual: true });
  const { document } = dom.window;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(STRIP_W));
  svg.setAttribute('height', String(STRIP_H));
  svg.setAttribute('viewBox', `0 0 ${STRIP_W} ${STRIP_H}`);
  svg.setAttribute('fill', '#fdfdfd');

  const rc = rough.svg(svg, {
    options: {
      roughness: 1.2,
      bowing: 1,
      stroke: '#111',
      strokeWidth: 2,
      fillWeight: 2,
      hachureGap: 4,
      disableMultiStroke: true,
      seed: stableSeed(panel),
    },
  });

  const title = document.createElementNS(SVG_NS, 'text');
  title.setAttribute('x', String(STRIP_W / 2));
  title.setAttribute('y', String(Math.round(TITLE_AREA * 0.7)));
  title.setAttribute('text-anchor', 'middle');
  title.setAttribute('font-family', 'Patrick Hand');
  title.setAttribute('font-size', '48');
  title.setAttribute('fill', '#111');
  title.textContent = panel.strip.title;
  svg.appendChild(title);

  panel.panels.forEach((p, i) => {
    const seed = stableSeed(panel) + i * 0x9e37;
    const px = MARGIN + i * (PANEL + GUTTER);
    const py = TITLE_AREA;
    const panelG = document.createElementNS(SVG_NS, 'g');
    panelG.setAttribute('transform', `translate(${px} ${py})`);
    svg.appendChild(panelG);

    panelG.appendChild(rc.rectangle(0, 0, PANEL, PANEL, { fill: '#fdfdfd', seed: seed + 0x1a2b }));

    const bgPath = join(assetsDir, 'backgrounds', `${p.background}.svg`);
    const imported = importedSvgNodes(dom, bgPath);
    const bgG = document.createElementNS(SVG_NS, 'g');
    bgG.setAttribute('transform', 'scale(8)');
    for (const n of imported.nodes) bgG.appendChild(document.importNode(n, true));
    panelG.appendChild(bgG);

    p.actors.forEach((a, j) => {
      const path = actorSvgPath(a.id, a.pose, a.expression);
      if (!path) return;
      const { nodes, doc } = importedSvgNodes(dom, path);
      const anchors = readAnchors(doc);
      const scale = PANEL / 100;
      const tx = (a.positionX / 100) * PANEL;
      const ty = (a.positionY / 100) * PANEL;
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('transform', `translate(${tx} ${ty}) scale(${scale}) translate(${-anchors.feet.x} ${-anchors.feet.y})`);
      for (const n of nodes) {
        if (n.getAttribute('id')?.startsWith('anchor-')) continue;
        const clone = document.importNode(n, true);
        const id = clone.getAttribute('id');
        if (id) clone.setAttribute('id', `${a.id}-${j}-${id}`);
        g.appendChild(clone);
      }
      panelG.appendChild(g);

      if (p.bubble) {
        const bubblePx = (p.bubble.targetX / 100) * PANEL;
        const bubblePy = (p.bubble.targetY / 100) * PANEL;
        const { w, h, lines } = bubbleSize(p.bubble.text);
        const mouth = {
          x: tx + (anchors.mouth.x - anchors.feet.x) * scale,
          y: ty + (anchors.mouth.y - anchors.feet.y) * scale,
        };
        const drawn = drawBubble({
          rc,
          style: p.bubble.style,
          cx: bubblePx,
          cy: bubblePy,
          w,
          h,
          mouthAnchor: mouth,
          seed,
        });
        const bubbleG = document.createElementNS(SVG_NS, 'g');
        for (const s of drawn.shapes) bubbleG.appendChild(s);
        panelG.appendChild(bubbleG);

        const textG = document.createElementNS(SVG_NS, 'g');
        const lineW = w - TEXT.PAD_X;
        const firstY = bubblePy - ((lines.length - 1) / 2) * TEXT.LINE_H + TEXT.FONT * 0.3;
        lines.forEach((line, k) => {
          const t = document.createElementNS(SVG_NS, 'text');
          t.setAttribute('x', String(bubblePx));
          t.setAttribute('y', String(Math.round(firstY + k * TEXT.LINE_H)));
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-family', 'Patrick Hand');
          t.setAttribute('font-size', String(TEXT.FONT));
          t.setAttribute('fill', '#111');
          t.textContent = line;
          textG.appendChild(t);
        });
        void lineW;
        panelG.appendChild(textG);
      }
    });
  });

  const serializer = new dom.window.XMLSerializer();
  return { svg: serializer.serializeToString(svg), width: STRIP_W, height: STRIP_H };
}