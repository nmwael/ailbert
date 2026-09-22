const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const DEFAULT = {
  roughness: 1.2,
  bowing: 1,
  stroke: '#111',
  strokeWidth: 2,
  fillWeight: 2,
  hachureGap: 4,
  disableMultiStroke: true,
};

function bodyOpts(style, seed, extra = {}) {
  const opts = { ...DEFAULT, seed, ...extra };
  if (style === 'whisper' || style === 'thought') opts.strokeLineDash = [4, 4];
  return opts;
}

function ellipseBoundaryPoint(cx, cy, rx, ry, dx, dy) {
  const adx = Math.abs(dx) < 1e-6 ? 1e-6 : dx;
  const ady = Math.abs(dy) < 1e-6 ? 1e-6 : dy;
  const t = 1 / Math.hypot(adx / rx, ady / ry);
  return { x: cx + adx * t, y: cy + ady * t };
}

function rectBoundaryPoint(cx, cy, hw, hh, dx, dy) {
  const adx = Math.abs(dx) < 1e-6 ? 1e-6 : dx;
  const ady = Math.abs(dy) < 1e-6 ? 1e-6 : dy;
  const tx = hw / Math.abs(adx);
  const ty = hh / Math.abs(ady);
  const t = Math.min(tx, ty);
  return {
    x: cx + Math.sign(adx) * t * Math.abs(adx),
    y: cy + Math.sign(ady) * t * Math.abs(ady),
  };
}

export function drawBubble({
  rc,
  style = 'speech',
  cx,
  cy,
  w,
  h,
  tailAnchor = null,
  mouthAnchor = null,
  panelW = 800,
  panelH = 800,
  seed = 0,
}) {
  const pad = 6;
  const hw = w / 2;
  const hh = h / 2;
  cx = clamp(cx, hw + pad, panelW - hw - pad);
  cy = clamp(cy, hh + pad, panelH - hh - pad);

  const m = mouthAnchor || tailAnchor || { x: cx + hw, y: cy };
  let dx = m.x - cx;
  let dy = m.y - cy;
  if (Math.hypot(dx, dy) < 1e-6) { dx = 1; dy = 0; }

  const nearEdge =
    m.x <= 100 || m.x >= panelW - 100 ||
    m.y <= 100 || m.y >= panelH - 100 ||
    Math.abs(dx) < hw * 0.3;
  if (nearEdge) {
    dx = m.x < cx ? -1 : 1;
    dy = 0;
  }

  const shapes = [];
  let edge;
  if (style === 'shout') {
    shapes.push(rc.rectangle(cx - hw, cy - hh, w, h, bodyOpts(style, seed, { fill: '#fff', fillStyle: 'hachure' })));
    edge = rectBoundaryPoint(cx, cy, hw, hh, dx, dy);
  } else {
    shapes.push(rc.ellipse(cx, cy, w, h, bodyOpts(style, seed, { fill: '#fff', fillStyle: 'hachure' })));
    edge = ellipseBoundaryPoint(cx, cy, hw, hh, dx, dy);
  }

  if (style === 'thought' && Math.hypot(m.x - cx, m.y - cy) > 6) {
    shapes.push(rc.circle(cx + (m.x - cx) * 0.55, cy + (m.y - cy) * 0.55, 7, bodyOpts(style, seed + 1, { fill: '#fff' })));
    shapes.push(rc.circle(cx + (m.x - cx) * 0.78, cy + (m.y - cy) * 0.78, 4, bodyOpts(style, seed + 2, { fill: '#fff' })));
  }

  const span = Math.hypot(m.x - edge.x, m.y - edge.y);
  if (span > 2) {
    const base = Math.min(26, span * 0.28);
    const ux = (m.x - edge.x) / span;
    const uy = (m.y - edge.y) / span;
    shapes.push(rc.polygon([
      [edge.x - uy * base, edge.y + ux * base],
      [edge.x + uy * base, edge.y - ux * base],
      [m.x, m.y],
    ], bodyOpts(style, seed + 3, { fill: '#fff', fillStyle: 'hachure' })));
  }

  return { shapes, geometry: { cx, cy, w, h } };
}