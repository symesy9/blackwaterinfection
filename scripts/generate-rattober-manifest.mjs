/**
 * Scans public/assets/rattober/* and writes trait manifest for the creator.
 * Run: npm run rattober:manifest
 */
import { readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const traitsRoot = join(root, "public", "assets", "rattober");
const outFile = join(root, "src", "features", "rattober", "config", "traits.generated.json");

const FOLDERS = {
  backgrounds: "backgrounds",
  skins: "skins",
  clothing: "clothing",
  eyes: "eyes",
  mouths: "mouths",
  hatsHair: "hats-hair",
};

function humanizeName(filename) {
  const base = filename.replace(/\.png$/i, "");
  return base
    .replace(/__/g, " / ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugId(category, filename) {
  const base = filename.replace(/\.png$/i, "").toLowerCase();
  return `${category}-${base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

const manifest = {
  generatedAt: new Date().toISOString(),
  canvasSize: 2048,
  traits: {},
};

for (const [category, folder] of Object.entries(FOLDERS)) {
  const dir = join(traitsRoot, folder);
  manifest.traits[category] = [];
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    continue;
  }
  const files = readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  manifest.traits[category] = files.map((file) => ({
    id: slugId(category, file),
    name: humanizeName(file),
    category,
    file,
  }));
}

writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const counts = Object.entries(manifest.traits)
  .map(([k, v]) => `${k}:${v.length}`)
  .join(", ");
console.log(`Wrote ${outFile}\nCounts: ${counts}`);
