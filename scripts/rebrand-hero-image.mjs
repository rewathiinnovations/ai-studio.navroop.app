#!/usr/bin/env node
/**
 * Rebrands the two "Multica Demo" labels baked into the landing hero
 * screenshot, which no string transform can reach.
 *
 * apps/web/public/images/landing-hero.webp is a 2640x1781 capture of the
 * product. It shows the demo workspace name twice — in the sidebar and in the
 * breadcrumb — plus the "M" workspace avatar beside each. Those are pixels, so
 * apps/web/lib/brand.ts cannot touch them, and the rendered-HTML audit reports
 * a clean page while the most prominent image on the site still reads Multica.
 *
 * "NR AI Studio" is deliberately the replacement rather than "NR AI Studio
 * Demo": it has the same twelve characters as "Multica Demo", so it occupies
 * the same width and cannot collide with the chevron or the ">" separator
 * sitting a few pixels to the right of each label.
 *
 * Old pixels are covered by sampling the same row a few pixels to either side
 * of the glyphs rather than filling with a flat colour, because the avatar
 * badge carries a vertical gradient that a flat fill would flatten visibly.
 *
 * Coordinates were measured from the image, not guessed. Re-measure if
 * upstream ever replaces the screenshot: the script would otherwise paint over
 * whatever now occupies these boxes.
 *
 * Usage: node scripts/rebrand-hero-image.mjs [--dry]
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(repoRoot, "apps", "web", "public", "images", "landing-hero.webp");

// Each glyph run to erase, with the clean columns to sample its cover from.
// `sampleAt` values are inside the same element (panel or badge) so the row's
// own colour is reused.
const ERASE = [
  { name: "sidebar name", x0: 92, x1: 231, y0: 56, y1: 81, sampleAt: [245, 250] },
  { name: "sidebar avatar", x0: 57, x1: 73, y0: 59, y1: 77, sampleAt: [53, 77] },
  { name: "breadcrumb name", x0: 447, x1: 581, y0: 50, y1: 74, sampleAt: [586, 590] },
  { name: "breadcrumb avatar", x0: 414, x1: 431, y0: 52, y1: 70, sampleAt: [410, 434] },
];

// Redrawn text. Sizes and baselines come from the measured cap heights.
const DRAW = [
  // Sidebar: bold, near-black, 16px ascender -> ~21px Inter.
  { text: "NR AI Studio", x: 94, baseline: 76, size: 21, weight: 700, fill: "#0b0b0c" },
  // Breadcrumb: medium, grey #5a595c, 15px ascender -> ~20px.
  { text: "NR AI Studio", x: 449, baseline: 69, size: 20, weight: 500, fill: "#5a595c" },
  // Avatar initials follow the workspace name, exactly as WorkspaceAvatar does.
  { text: "N", x: 59, baseline: 74, size: 18, weight: 600, fill: "#58575f" },
  { text: "N", x: 416, baseline: 67, size: 18, weight: 600, fill: "#58575f" },
];

const dry = process.argv.includes("--dry");

const { data, info } = await sharp(await readFile(target))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const px = (x, y) => (y * width + x) * channels;

for (const { name, x0, x1, y0, y1, sampleAt } of ERASE) {
  for (let y = y0; y <= y1; y++) {
    // Average the two sample columns so a slight horizontal gradient in the
    // row averages out instead of banding toward one side.
    const rgb = [0, 1, 2].map((c) =>
      Math.round(
        sampleAt.reduce((sum, sx) => sum + data[px(sx, y) + c], 0) / sampleAt.length,
      ),
    );
    for (let x = x0; x <= x1; x++) {
      const i = px(x, y);
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
  console.log(`  erased ${name.padEnd(18)} x ${x0}..${x1}  y ${y0}..${y1}`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
${DRAW.map(
  ({ text, x, baseline, size, weight, fill }) =>
    `  <text x="${x}" y="${baseline}" font-family="Segoe UI, Inter, Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="-0.2">${text}</text>`,
).join("\n")}
</svg>`;

const out = await sharp(data, { raw: { width, height, channels } })
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .webp({ quality: 90, effort: 6 })
  .toBuffer();

console.log(`  drew ${DRAW.length} text runs`);

if (dry) {
  const preview = join(repoRoot, "hero-preview.png");
  await sharp(out).extract({ left: 0, top: 0, width: 900, height: 190 }).resize({ width: 1100 }).png().toFile(preview);
  console.log(`  DRY RUN -> ${preview}`);
} else {
  await writeFile(target, out);
  console.log(`  wrote ${target}  ${(out.length / 1024).toFixed(1)}KB`);
}
