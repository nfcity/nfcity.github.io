// Builds the faces of the 3D product cards (src/assets/card/*.webp).
// Run: node scripts/make-card-textures.mjs
//
// The skyline artwork in src/assets/card/source/ was generated with Higgsfield.
// Here it is recoloured to the brand palette only, then the real logo, the stars
// and the signal arcs are laid on top so they stay exact.
import sharp from 'sharp';
import * as fontkit from 'fontkit';

const NAVY = [4, 7, 45]; // --color-navy
const NAVY_3 = [23, 28, 87]; // --color-navy-3
const CREAM = [251, 238, 217]; // --color-cream
const RED = '#de1d2b'; // --color-red

const W = 1280;
const H = Math.round(W / 1.586); // bank-card proportions
const OUT = 'src/assets/card';
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

/**
 * Crops the artwork to card proportions (keeping the skyline at the bottom) and
 * maps its light-to-dark range onto two brand colours, so no other colour survives.
 */
async function recolour(file, lightColour, darkColour) {
  const meta = await sharp(file).metadata();
  const cropH = Math.round(meta.width / 1.586);
  const { data, info } = await sharp(file)
    .extract({ left: 0, top: meta.height - cropH, width: meta.width, height: cropH })
    .resize(W, H, { kernel: 'lanczos3' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const lum = new Float32Array(W * H);
  for (let i = 0, p = 0; i < data.length; i += info.channels, p++) {
    lum[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  const sorted = Float32Array.from(lum).sort();
  const lo = sorted[Math.floor(sorted.length * 0.004)];
  const hi = sorted[Math.floor(sorted.length * 0.996)];

  const out = Buffer.alloc(W * H * 3);
  for (let p = 0; p < lum.length; p++) {
    const t = Math.max(0, Math.min(1, (lum[p] - lo) / (hi - lo)));
    const c = mix(darkColour, lightColour, t);
    out[p * 3] = c[0];
    out[p * 3 + 1] = c[1];
    out[p * 3 + 2] = c[2];
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } });
}

/** The logo PNG holds exactly two colours; this returns it with the cream parts repainted. */
async function logo({ cream, crop }) {
  let image = sharp('src/assets/brand/logo.png');
  if (crop) image = image.extract(crop);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const isRed = data[i + 1] < 120;
    if (!isRed) [data[i], data[i + 1], data[i + 2]] = cream;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

/** Bounding box of the "NFC" letters alone: the cream pixels left of the first red arc. */
async function wordmarkBox() {
  const { data, info } = await sharp('src/assets/brand/logo.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => (y * info.width + x) * 4;
  let firstRed = info.width;
  for (let x = 0; x < info.width && firstRed === info.width; x++) {
    for (let y = 0; y < info.height; y++) {
      const i = at(x, y);
      if (data[i + 3] > 128 && data[i + 1] < 120) {
        firstRed = x;
        break;
      }
    }
  }
  let top = info.height;
  let bottom = 0;
  let right = 0;
  // The N at the far left gives the true letter height.
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < Math.round(info.width * 0.2); x++) {
      if (data[at(x, y) + 3] > 128) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < firstRed; x++) {
      if (data[at(x, y) + 3] > 128) right = Math.max(right, x);
    }
  }
  return { left: 0, top, width: right + 1, height: bottom - top + 1 };
}

// ---- Fronts: cream faces, laid out like the drawn mockups on the site -------
// One per product. The red signal arcs are left off on purpose: the 3D card
// draws them as their own layer so they can pulse.
const S = W / 196; // the mockup card is 196 x 124 units
const navy = hex(NAVY);
const star = 'M12 2.9l2.72 5.6 6.13.86-4.45 4.3 1.07 6.1L12 16.85 6.53 19.76l1.07-6.1-4.45-4.3 6.13-.86z';

// The "@" on the Instagram / Telegram card, as an outline in Unbounded 800.
const heavy = fontkit.openSync('node_modules/@fontsource/unbounded/files/unbounded-latin-800-normal.woff');
const at = heavy.layout('@').glyphs[0];
const atScale = 44 / heavy.unitsPerEm;

const marks = {
  review: [0, 1, 2, 3, 4]
    .map((i) => `<path d="${star}" transform="translate(${16 + i * 25} 38) scale(0.96)"/>`)
    .join(''),
  business: `
    <circle cx="34" cy="50" r="17"/>
    <rect x="62" y="38" width="66" height="8" rx="4"/>
    <rect x="62" y="54" width="42" height="6" rx="3" opacity="0.4"/>`,
  social: `
    <path transform="translate(14 67) scale(${atScale} ${-atScale})" d="${at.path.toSVG()}"/>
    <rect x="66" y="38" width="68" height="8" rx="4"/>
    <rect x="66" y="54" width="44" height="6" rx="3" opacity="0.4"/>`,
  menu: [
    [30, 58],
    [46, 42],
    [62, 64],
  ]
    .map(
      ([y, w]) => `
    <rect x="16" y="${y}" width="${w}" height="6" rx="3"/>
    <rect x="124" y="${y}" width="18" height="6" rx="3" opacity="0.4"/>
    <path d="M${24 + w} ${y + 3}H116" fill="none" stroke="${navy}" stroke-width="1.6" stroke-dasharray="0.1 5" stroke-linecap="round" opacity="0.5"/>`,
    )
    .join(''),
};

const box = await wordmarkBox();
const wordmarkH = Math.round(10.5 * S);
const wordmark = await (await logo({ cream: NAVY, crop: box }))
  .resize({ height: wordmarkH })
  .png()
  .toBuffer();

const skyline = await (
  await recolour(`${OUT}/source/front-skyline.webp`, CREAM, mix(CREAM, NAVY, 0.18))
)
  .png()
  .toBuffer();

for (const [kind, shapes] of Object.entries(marks)) {
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g transform="scale(${S})" fill="${navy}">${shapes}</g></svg>`,
  );
  const face = await sharp(skyline)
    .composite([
      { input: overlay },
      { input: wordmark, left: Math.round(16 * S), top: Math.round(107 * S) - wordmarkH },
    ])
    .png()
    .toBuffer();
  // The large Google card is seen bigger than the other three.
  await sharp(face)
    .resize({ width: kind === 'review' ? W : 896 })
    .webp({ quality: 90 })
    .toFile(`${OUT}/front-${kind}.webp`);
}

// ---- Back: navy face with the full logo and the site address ---------------
const logoW = Math.round(W * 0.44);
const fullLogo = await (await logo({ cream: CREAM })).resize({ width: logoW }).png().toBuffer();
const logoH = (await sharp(fullLogo).metadata()).height;

const font = fontkit.openSync(
  'node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2',
);
const size = 30;
const scale = size / font.unitsPerEm;
const run = font.layout('nfcity.uz');
let x = 0;
let glyphs = '';
run.glyphs.forEach((glyph, i) => {
  glyphs += `<path transform="translate(${x.toFixed(2)} 0) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
  x += run.positions[i].xAdvance * scale + size * 0.05;
});
const logoTop = Math.round(H * 0.17);
const address = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <g fill="${hex(CREAM)}" opacity="0.72" transform="translate(${((W - x) / 2).toFixed(1)} ${logoTop + logoH + 74})">${glyphs}</g>
</svg>`);

const back = await recolour(`${OUT}/source/back-skyline.webp`, NAVY_3, NAVY);
await back
  .composite([
    { input: fullLogo, left: Math.round((W - logoW) / 2), top: logoTop },
    { input: address },
  ])
  .webp({ quality: 90 })
  .toFile(`${OUT}/back.webp`);

console.log(`Wrote ${OUT}/front-{review,business,social,menu}.webp and ${OUT}/back.webp`);
