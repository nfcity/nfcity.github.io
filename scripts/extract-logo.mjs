// Cuts the NFC logo out of the splash image (src/assets/brand/logo-source.jpg)
// and saves it as a transparent PNG. Run: node scripts/extract-logo.mjs
// Replace src/assets/brand/logo.png with an original vector/transparent file when available.
import sharp from 'sharp';

const SRC = 'src/assets/brand/logo-source.jpg';
const CREAM = [251, 238, 217];
const RED = [222, 29, 43];
const box = { left: 220, top: 701, width: 542, height: 222 };
const SCALE = 3;

const { data, info } = await sharp(SRC)
  .extract(box)
  .resize({ width: box.width * SCALE, kernel: 'lanczos3' })
  .raw()
  .toBuffer({ resolveWithObject: true });

const out = Buffer.alloc(info.width * info.height * 4);
const clamp = (v) => Math.max(0, Math.min(1, v));
for (let i = 0, o = 0; i < data.length; i += info.channels, o += 4) {
  const r = data[i], g = data[i + 1];
  const isRed = r > 70 && g < r * 0.55;
  const a = isRed ? clamp((r - 70) / 120) : clamp((g - 75) / 130);
  const c = isRed ? RED : CREAM;
  out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
  out[o + 3] = Math.round(a * 255);
}

const png = sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 1 });
await png.clone().png({ compressionLevel: 9 }).toFile('src/assets/brand/logo.png');
await png.clone().resize({ width: 600 }).png({ compressionLevel: 9 }).toFile('public/logo.png');
const m = await sharp('src/assets/brand/logo.png').metadata();
console.log('logo.png', m.width, m.height);
