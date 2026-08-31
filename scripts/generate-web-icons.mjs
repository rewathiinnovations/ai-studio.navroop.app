#!/usr/bin/env node
// Rasterizes apps/web/public/icons/icon.svg into the PNG set that
// apps/web/app/manifest.ts and the root layout reference.
//
// Replaces the `sips` pipeline documented in manifest.ts upstream, which is
// macOS-only. sharp is already a transitive dependency of the web build, and
// it bundles its own SVG renderer, so this runs identically on every platform.
//
// All four PNGs come from icon.svg — the full-bleed dark treatment. Upstream
// sourced the two `purpose: "any"` icons from apps/desktop/build/icon.png
// instead, which this fork deliberately does not rebrand, so pulling from it
// would ship upstream artwork on our web app icon.
//
// Usage:
//   node scripts/generate-web-icons.mjs

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(repoRoot, "apps", "web", "public", "icons");

const OUTPUTS = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

const svg = await readFile(join(iconsDir, "icon.svg"));

for (const { file, size } of OUTPUTS) {
  const png = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "fill" })
    // The artwork is two flat colours plus antialiasing, so a palette encode is
    // both smaller and lossless here. `flatten` drops the alpha channel: iOS
    // renders a transparent apple-touch-icon on a black background.
    .flatten({ background: "#111827" })
    .png({ compressionLevel: 9, palette: true, effort: 10 })
    .toBuffer();

  await writeFile(join(iconsDir, file), png);
  console.log(`${file}  ${size}x${size}  ${(png.length / 1024).toFixed(1)}KB`);
}
