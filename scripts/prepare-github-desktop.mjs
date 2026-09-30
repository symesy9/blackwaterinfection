/**
 * Build + publish the live site, then stage the files GitHub Desktop should commit.
 * Does NOT commit or push — use GitHub Desktop (or git push) after reviewing the diff.
 *
 * Usage: npm run prepare:github
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: root, stdio: "inherit", ...opts });
}

console.log("\n▶ Building and publishing to index.html, 404.html, assets/ …\n");
run("npm run publish");

/** Paths that are safe and needed for GitHub Pages + source (not secrets). */
const stagePaths = [
  "index.html",
  "404.html",
  "CNAME",
  "assets/",
  "public/",
  "dist/",
  "src/",
  "scripts/",
  "docs/",
  "supabase/",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "vitest.config.ts",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "index.vite.html",
  ".env.example",
  ".gitignore",
].filter((p) => existsSync(join(root, p)));

console.log("\n▶ Staging files for GitHub Desktop …\n");
run(`git add ${stagePaths.map((p) => JSON.stringify(p)).join(" ")}`);

/* Drop tracked node_modules from the index (folder stays on disk, gitignored). */
const trackedNodeModules = execSync("git ls-files node_modules | wc -l", {
  encoding: "utf8",
  cwd: root,
}).trim();
if (trackedNodeModules !== "0") {
  console.log(
    `\n▶ Removing ${trackedNodeModules} tracked node_modules paths from git (still on disk) …\n`,
  );
  run("git rm -r --cached --quiet node_modules", { stdio: "inherit" });
}

const staged = execSync("git diff --cached --name-only", {
  encoding: "utf8",
  cwd: root,
}).trim();

console.log("\n══════════════════════════════════════════════════════════");
if (!staged) {
  console.log("Nothing staged — working tree already matches the latest build.");
} else {
  const lines = staged.split("\n");
  console.log(`Staged ${lines.length} path(s) for commit. Examples:`);
  for (const line of lines.slice(0, 12)) console.log(`  • ${line}`);
  if (lines.length > 12) console.log(`  … and ${lines.length - 12} more`);
}
console.log("\nNOT staged (on purpose):");
console.log("  • .env.local / .env  — secrets stay on your Mac");
console.log("  • node_modules/      — ignored after this cleanup");
console.log("\nNext: open GitHub Desktop → review changes → Commit → Push origin");
console.log("Live site uses: index.html, 404.html, assets/ at repo root.");
console.log("══════════════════════════════════════════════════════════\n");
