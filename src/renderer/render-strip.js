import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { renderStrip, renderPanel, PANEL } from './compose.js';
import { validate } from '../schema/validate.js';
import { buildResvgFontConfig } from './font.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--panel') args.panel = argv[i + 1];
  }
  return args;
}

function render(panelPath) {
  const panel = JSON.parse(readFileSync(panelPath, 'utf8'));
  const v = validate(panel);
  if (!v.ok) {
    console.error(`render-strip: invalid panel JSON (${panelPath})`);
    for (const e of v.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const { svg, width, height } = renderStrip(panel);
  const font = buildResvgFontConfig();

  mkdirSync(join(root, 'out'), { recursive: true });
  const svgOut = join(root, 'out', 'strip.svg');
  writeFileSync(svgOut, svg);

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 800 },
    font,
    background: '#fdfdfd',
  });
  const pngData = resvg.render().asPng();
  const pngOut = join(root, 'out', 'strip.png');
  writeFileSync(pngOut, pngData);

  panel.panels.forEach((p, i) => {
    const { svg: panelSvg } = renderPanel(panel, i);
    const panelSvgOut = join(root, 'out', `panel-${i}.svg`);
    writeFileSync(panelSvgOut, panelSvg);
    const panelResvg = new Resvg(panelSvg, {
      fitTo: { mode: 'width', value: 800 },
      font,
      background: '#fdfdfd',
    });
    const panelPng = panelResvg.render().asPng();
    const panelPngOut = join(root, 'out', `panel-${i}.png`);
    writeFileSync(panelPngOut, panelPng);
    console.log(`panel-${i}.png  -> ${panelPngOut} (${PANEL}x${PANEL})`);
  });

  console.log(`strip.svg  -> ${svgOut}`);
  console.log(`strip.png  -> ${pngOut} (${width}x${height} viewBox, 800px wide PNG)`);
}

const args = parseArgs(process.argv.slice(2));
render(args.panel || join(root, 'fixtures', 'sample', 'panel.json'));