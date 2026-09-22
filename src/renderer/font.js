import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FONT = 'PatrickHand-Regular.ttf';

export function findFont() {
  const p = join(HERE, 'assets', 'fonts', FONT);
  if (!existsSync(p)) {
    throw new Error(
      `assets/fonts/${FONT} not found — run "npm run setup" (bash scripts/fetch-fonts.sh) to fetch the vendored font`
    );
  }
  return p;
}

export function buildResvgFontConfig() {
  return {
    fontFiles: [findFont()],
    loadSystemFonts: false,
    defaultFontFamily: 'Patrick Hand',
  };
}