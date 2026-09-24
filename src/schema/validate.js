import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_MANIFEST = join(HERE, 'assets', 'manifest.json');

function isNumInRange(v, lo, hi) {
  return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function validate(panel, manifest = null) {
  const errors = [];
  let man = manifest;
  if (!man) {
    try {
      man = JSON.parse(readFileSync(DEFAULT_MANIFEST, 'utf8'));
    } catch (e) {
      return { ok: false, manifestLoaded: false, errors: ['manifest unreadable: ' + e.message] };
    }
  }

  if (!panel || typeof panel !== 'object' || Array.isArray(panel)) {
    return { ok: false, manifestLoaded: true, errors: ['strip: panel must be an object'] };
  }
  const strip = panel.strip;
  if (!strip || typeof strip.title !== 'string' || strip.title.trim().length === 0) {
    errors.push('strip.title: required, non-empty string');
  }
  if (strip && strip.date !== undefined && strip.date !== null) {
    if (typeof strip.date !== 'string' || !isValidDate(strip.date)) {
      errors.push(`strip.date: optional but must be an ISO YYYY-MM-DD date when present, got '${strip.date}'`);
    }
  }
  if (!Array.isArray(panel.panels)) {
    errors.push('panels: required array');
    return { ok: false, manifestLoaded: true, errors };
  }
  if (panel.panels.length !== 3) {
    errors.push(`panels: exactly 3 required, got ${panel.panels.length}`);
  }

  panel.panels.forEach((p, i) => {
    const tag = `panels[${i}]`;
    if (!p || typeof p !== 'object') {
      errors.push(`${tag}: must be an object`);
      return;
    }
    if (typeof p.background !== 'string') {
      errors.push(`${tag}.background: required string`);
    } else if (!(man.backgrounds || []).includes(p.background)) {
      errors.push(`${tag}.background: '${p.background}' is not in assets/manifest.json backgrounds (${man.backgrounds.join(', ')})`);
    }
    if (!Array.isArray(p.actors)) {
      errors.push(`${tag}.actors: required array`);
    } else if (p.actors.length === 0) {
      errors.push(`${tag}.actors: at least one actor required`);
    } else {
      p.actors.forEach((a, j) => {
        const atag = `${tag}.actors[${j}]`;
        if (!a || typeof a !== 'object') {
          errors.push(`${atag}: must be an object`);
          return;
        }
        if (typeof a.id !== 'string') {
          errors.push(`${atag}.id: required string`);
        } else if (!man.actors || !man.actors[a.id]) {
          errors.push(`${atag}.id: unknown actor id '${a.id}' — not in assets/manifest.json`);
        } else {
          if (typeof a.pose !== 'string') {
            errors.push(`${atag}.pose: required string`);
          } else if (!(man.actors[a.id].poses || []).includes(a.pose)) {
            errors.push(`${atag}.pose: '${a.pose}' not in hallmark ${a.id} poses (${man.actors[a.id].poses.join(', ')})`);
          }
          if (typeof a.expression !== 'string') {
            errors.push(`${atag}.expression: required string`);
          } else if (!(man.actors[a.id].expressions || []).includes(a.expression)) {
            errors.push(`${atag}.expression: '${a.expression}' not valid for ${a.id} (${man.actors[a.id].expressions.join(', ')})`);
          }
        }
        if (!isNumInRange(a.positionX, 0, 100)) errors.push(`${atag}.positionX: number 0-100 required`);
        if (!isNumInRange(a.positionY, 0, 100)) errors.push(`${atag}.positionY: number 0-100 required`);
        if (a.layer !== undefined && a.layer !== null && !['back', 'main', 'front'].includes(a.layer)) {
          errors.push(`${atag}.layer: must be one of back|main|front`);
        }
      });
    }
    if (p.bubble !== undefined && p.bubble !== null) {
      const b = p.bubble;
      const btag = `${tag}.bubble`;
      if (typeof b !== 'object') {
        errors.push(`${btag}: must be an object`);
      } else {
        if (typeof b.text !== 'string' || b.text.trim().length === 0) {
          errors.push(`${btag}.text: required non-empty string`);
        } else if (b.text.length > 90) {
          errors.push(`${btag}.text: ${b.text.length} chars > 90 max`);
        }
        if (!isNumInRange(b.targetX, 0, 100)) errors.push(`${btag}.targetX: number 0-100 required`);
        if (!isNumInRange(b.targetY, 0, 100)) errors.push(`${btag}.targetY: number 0-100 required`);
        if (typeof b.style !== 'string') {
          errors.push(`${btag}.style: required string`);
        } else if (!(man.bubbleStyles || []).includes(b.style)) {
          errors.push(`${btag}.style: '${b.style}' not in bubbleStyles enum (${man.bubbleStyles.join(', ')})`);
        }
      }
    }
    if (p.bubbles !== undefined && p.bubbles !== null) {
      const btag = `${tag}.bubbles`;
      if (!Array.isArray(p.bubbles)) {
        errors.push(`${btag}: must be an array when present`);
      } else {
        p.bubbles.forEach((b, bi) => {
          const bbi = `${btag}[${bi}]`;
          if (!b || typeof b !== 'object') {
            errors.push(`${bbi}: must be an object`);
            return;
          }
          if (typeof b.text !== 'string' || b.text.trim().length === 0) {
            errors.push(`${bbi}.text: required non-empty string`);
          } else if (b.text.length > 90) {
            errors.push(`${bbi}.text: ${b.text.length} chars > 90 max`);
          }
          if (typeof b.style !== 'string') {
            errors.push(`${bbi}.style: required string`);
          } else if (!(man.bubbleStyles || []).includes(b.style)) {
            errors.push(`${bbi}.style: '${b.style}' not in bubbleStyles enum (${man.bubbleStyles.join(', ')})`);
          }
          if (b.actorIndex !== undefined && b.actorIndex !== null) {
            if (!Number.isInteger(b.actorIndex)) {
              errors.push(`${bbi}.actorIndex: integer required when present`);
            } else if (!Array.isArray(p.actors) || b.actorIndex < 0 || b.actorIndex >= p.actors.length) {
              errors.push(`${bbi}.actorIndex: must be in 0..${p.actors.length - 1}`);
            }
          }
          if (b.targetX !== undefined && b.targetX !== null && !isNumInRange(b.targetX, 0, 100)) {
            errors.push(`${bbi}.targetX: number 0-100 when present`);
          }
          if (b.targetY !== undefined && b.targetY !== null && !isNumInRange(b.targetY, 0, 100)) {
            errors.push(`${bbi}.targetY: number 0-100 when present`);
          }
          if (b.actorIndex === undefined || b.actorIndex === null) {
            if (b.targetX === undefined || b.targetX === null) errors.push(`${bbi}.targetX: required unless actorIndex is present`);
            if (b.targetY === undefined || b.targetY === null) errors.push(`${bbi}.targetY: required unless actorIndex is present`);
          }
        });
      }
    }
  });

  return { ok: errors.length === 0, manifestLoaded: true, errors };
}