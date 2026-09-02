/**
 * Builds every logo and icon the app serves from ONE source file:
 * assets/logo-source.jpeg, the client's artwork.
 *
 * The source is a gold lockup on a near-black square. Two things are derived
 * from it:
 *
 *   logo.png / mail-logo.png   the full lockup with the background removed
 *   icons/*                    the monogram alone, on the app's own dark ground
 *
 * The background is removed by turning brightness into opacity rather than by
 * keying one colour. The artwork is light on near-black, so luminance already
 * describes the shape, and the ramp keeps the antialiased edges soft instead of
 * leaving the jagged fringe a hard colour key gives you on a JPEG.
 *
 * The icons use the monogram ONLY. The full lockup carries three lines of type
 * that turn to mud below about 128px, and a favicon is 16.
 *
 *   npm run icons
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'public', 'icons');
const SOURCE = join(ROOT, 'assets', 'logo-source.jpeg');

const BG = '#0B0B0D'; // --bg, so an icon matches the app's first paint

/** Measured from the source: the monogram sits above the wordmark. */
const MONOGRAM = { top: 0.085, bottom: 0.505, left: 0.24, right: 0.76 };

/**
 * Below this size the monogram is cropped to the letterform alone.
 *
 * The circle arc is a hairline and the flourishes are filigree: at 32px both
 * dissolve into a smear that reads as a dark blob rather than as the mark.
 * Dropping them lets the S itself fill the tile, which is what survives being
 * shrunk to a browser tab.
 */
const TIGHT_BELOW = 64;

/**
 * Brightness becomes opacity.
 *
 * Below LO is background and disappears; above HI is artwork and is fully
 * opaque; between the two it ramps, which is what preserves the soft edge.
 * The RGB is left untouched, so the gold stays gold.
 */
const LO = 14;
const HI = 42;

async function transparent(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  const out = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    // Rec. 709 luma: matches how the eye weights these channels, so gold
    // (heavy in red and green) is not under-read as background.
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const a = lum <= LO ? 0 : lum >= HI ? 255 : Math.round(((lum - LO) / (HI - LO)) * 255);
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

/** The monogram, cropped from the source. */
async function monogram() {
  const meta = await sharp(SOURCE).metadata();
  const W = meta.width, H = meta.height;
  return sharp(SOURCE).extract({
    left: Math.round(W * MONOGRAM.left),
    top: Math.round(H * MONOGRAM.top),
    width: Math.round(W * (MONOGRAM.right - MONOGRAM.left)),
    height: Math.round(H * (MONOGRAM.bottom - MONOGRAM.top)),
  }).toBuffer();
}

/**
 * One icon: the monogram on the brand's dark ground.
 *
 * `inset` is the share of the canvas left as breathing room. Maskable icons
 * need a wide one because Android crops to whatever shape the launcher wants,
 * and anything outside the middle 80% can be cut off.
 */
/**
 * The S alone, as a share of the monogram crop.
 *
 * Measured off the artwork rather than detected: a brightness threshold cannot
 * separate the letterform from the circle, because the arc is as bright as the
 * S and spans the full width, so its bounding box is simply the whole frame.
 */
const LETTER = { left: 0.30, right: 0.70, top: 0.07, bottom: 0.76 };

async function icon(size, inset) {
  const mono = await monogram();

  // Small tiles get the letterform only; large ones keep the full monogram.
  let source = mono;
  if (size < TIGHT_BELOW) {
    const m = await sharp(mono).metadata();
    source = await sharp(mono).extract({
      left: Math.round(m.width * LETTER.left),
      top: Math.round(m.height * LETTER.top),
      width: Math.round(m.width * (LETTER.right - LETTER.left)),
      height: Math.round(m.height * (LETTER.bottom - LETTER.top)),
    })
      // The gold carries 3D shading that averages dark once it is 32px wide.
      // A modest lift keeps it reading as gold rather than as a smudge.
      .modulate({ brightness: 1.18, saturation: 1.1 })
      .toBuffer();
  }
  const art = await transparent(source).then((s) => s.trim().toBuffer());
  const box = Math.round(size * (1 - inset * 2));
  const scaled = await sharp(art).resize(box, box, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: scaled, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(ICONS, { recursive: true });

  // The lockup, background gone, trimmed to the artwork.
  const lockup = await transparent(SOURCE).then((s) => s.trim().toBuffer());
  const wide = await sharp(lockup).resize({ width: 720, withoutEnlargement: true }).png().toBuffer();
  await writeFile(join(ROOT, 'public', 'logo.png'), wide);
  await writeFile(join(ROOT, 'public', 'mail-logo.png'), wide);
  console.log('  ✓ logo.png, mail-logo.png (transparent lockup)');

  // The monogram on its own, transparent, for anywhere the lockup is too wide.
  const markOnly = await transparent(await monogram()).then((s) => s.trim().resize({ width: 512 }).png().toBuffer());
  await writeFile(join(ROOT, 'public', 'logo-mark.png'), markOnly);
  console.log('  ✓ logo-mark.png (transparent monogram)');

  const targets = [
    // Tight inset at small sizes: every pixel of padding is a pixel the mark
    // does not get.
    ['favicon-16.png', 16, 0.02],
    ['favicon-32.png', 32, 0.02],
    ['icon-96.png', 96, 0.07],
    ['icon-128.png', 128, 0.07],
    ['icon-192.png', 192, 0.07],
    ['icon-256.png', 256, 0.07],
    ['icon-384.png', 384, 0.07],
    ['icon-512.png', 512, 0.07],
    // Apple never masks, but it does round the corners itself.
    ['apple-touch-icon.png', 180, 0.10],
    // Maskable: the launcher may crop to a circle, so stay inside the safe zone.
    ['icon-maskable-192.png', 192, 0.20],
    ['icon-maskable-512.png', 512, 0.20],
  ];

  for (const [name, size, inset] of targets) {
    await writeFile(join(ICONS, name), await icon(size, inset));
    console.log(`  ✓ icons/${name}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
