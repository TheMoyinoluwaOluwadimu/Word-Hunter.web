// Renders the brand SVGs in brand/ into the PNG/ICO files the site serves from public/.
//
//   npm install --no-save @resvg/resvg-js
//   node brand/make-assets.mjs
//
// The share image uses Lilita One (SIL Open Font License) from brand/fonts/LilitaOne-Regular.ttf.
// Run it again whenever you change an SVG in brand/, then commit the files it writes to public/.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));
const svg = (name) => readFileSync(path(`brand/${name}`), 'utf8');
const out = (name, data) => {
  writeFileSync(path(`public/${name}`), data);
  console.log(`public/${name}  ${(data.length / 1024).toFixed(1)} kB`);
};

function png(source, width) {
  const resvg = new Resvg(source, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: [path('brand/fonts/LilitaOne-Regular.ttf')], loadSystemFonts: false, defaultFontFamily: 'Lilita One' },
  });
  return resvg.render().asPng();
}

/** A .ico holding one PNG image (every browser and OS from the last decade reads this). */
function ico(pngData, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header[6] = size; // width
  header[7] = size; // height
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(pngData.length, 14); // image size
  header.writeUInt32LE(22, 18); // image offset
  return Buffer.concat([header, pngData]);
}

const favicon = svg('favicon.svg');
const appIcon = svg('app-icon.svg');

out('favicon.svg', favicon);
out('favicon-32.png', png(favicon, 32));
out('favicon.ico', ico(png(favicon, 32), 32));
out('apple-touch-icon.png', png(appIcon, 180));
out('icon-192.png', png(appIcon, 192));
out('icon-512.png', png(appIcon, 512));
out('og-image.png', png(svg('og-image.svg'), 1200));
