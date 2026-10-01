/**
 * Build WebP derivatives for Rattober traits (grid + preview). Full PNGs stay for export.
 * Run: npm run rattober:thumbnails  (also runs after rattober:manifest)
 */
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const traitsRoot = join(root, "public", "assets", "rattober");

const FOLDERS = {
  backgrounds: "backgrounds",
  backgroundOverlays: "background-overlays",
  skins: "skins",
  clothing: "clothing",
  lowerRings: "lower-rings",
  outerRings: "outer-rings",
  eyes: "eyes",
  mouths: "mouths",
  hatsHair: "hats-hair",
};

const VARIANTS = [
  { key: "thumbs", size: 384, quality: 80 },
  { key: "preview", size: 768, quality: 84 },
];

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error(
    "Missing `sharp`. Run: npm install\nThen re-run: npm run rattober:thumbnails",
  );
  process.exit(1);
}

function needsRegen(outPath, sourcePath) {
  if (!existsSync(outPath)) return true;
  return statSync(outPath).mtimeMs < statSync(sourcePath).mtimeMs;
}

let written = 0;
let skipped = 0;

for (const folder of Object.values(FOLDERS)) {
  const dir = join(traitsRoot, folder);
  if (!existsSync(dir)) continue;

  for (const name of readdirSync(dir)) {
    if (!name.toLowerCase().endsWith(".png")) continue;
    const sourcePath = join(dir, name);
    const base = name.replace(/\.png$/i, "");

    for (const variant of VARIANTS) {
      const outDir = join(traitsRoot, "_derived", variant.key, folder);
      mkdirSync(outDir, { recursive: true });
      const outPath = join(outDir, `${base}.webp`);

      if (!needsRegen(outPath, sourcePath)) {
        skipped += 1;
        continue;
      }

      await sharp(sourcePath)
        .resize(variant.size, variant.size, {
          fit: "inside",
          withoutEnlargement: true,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: variant.quality, effort: 4 })
        .toFile(outPath);

      written += 1;
    }
  }
}

console.log(
  `Rattober derivatives: ${written} WebP file(s) written, ${skipped} up to date.`,
);
