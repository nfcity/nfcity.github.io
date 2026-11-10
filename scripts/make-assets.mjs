// Builds the share image and icon PNGs from the brand artwork.
// Run: node scripts/make-assets.mjs
import sharp from 'sharp';
import * as fontkit from 'fontkit';

const CREAM = '#fbeed9';

// --- Favicons from the SVG mark -------------------------------------------
await sharp('public/favicon.svg', { density: 384 }).resize(48, 48).png().toFile('public/favicon-48.png');
await sharp('public/favicon.svg', { density: 1024 })
  .resize(180, 180)
  .flatten({ background: '#04072d' })
  .png()
  .toFile('public/apple-touch-icon.png');

// --- Open Graph image (1200 x 630) ----------------------------------------
// The logo on its night skyline, cropped from the brand's own splash artwork.
const W = 1200;
const H = 630;
const src = sharp('src/assets/brand/logo-source.jpg');
const { width } = await src.metadata();
const cropH = Math.round((width * H) / W);
const logoCentreY = 812;
const base = await src
  .extract({ left: 0, top: Math.round(logoCentreY - cropH * 0.46), width, height: cropH })
  .resize(W, H, { kernel: 'lanczos3' })
  .toBuffer();

// "nfcity.uz" set in Unbounded, converted to outlines so no font is needed at render time.
const font = fontkit.openSync(
  'node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2',
);
const text = 'nfcity.uz';
const size = 30;
const scale = size / font.unitsPerEm;
const run = font.layout(text);
let x = 0;
let paths = '';
run.glyphs.forEach((glyph, i) => {
  paths += `<path transform="translate(${x.toFixed(2)} 0) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
  x += run.positions[i].xAdvance * scale + size * 0.04;
});
const label = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
     <g fill="${CREAM}" opacity="0.92" transform="translate(${((W - x) / 2).toFixed(1)} ${H - 62})">${paths}</g>
   </svg>`,
);

await sharp(base)
  .composite([{ input: label }])
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile('public/og.png');

console.log('Wrote public/og.png, public/favicon-48.png, public/apple-touch-icon.png');
