import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadManifest(path = join(HERE, 'assets', 'manifest.json')) {
  const raw = readFileSync(path, 'utf8');
  const man = JSON.parse(raw);
  if (!man.actors || !man.backgrounds || !man.bubbleStyles) {
    throw new Error('asserts/manifest.json: missing actors/backgrounds/bubbleStyles');
  }
  return man;
}

export function isKnownActor(id, pose, expression, man = {}) {
  const a = man.actors?.[id];
  return Boolean(a && a.poses?.includes(pose) && a.expressions?.includes(expression));
}

export function isKnownBackground(name, man = {}) {
  return (man.backgrounds || []).includes(name);
}

export function isKnownStyle(name, man = {}) {
  return (man.bubbleStyles || []).includes(name);
}