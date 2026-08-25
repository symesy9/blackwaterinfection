/**
 * Build, publish to repo root, stage site files, and commit.
 * Usage: npm run deploy:site -- "Your commit message"
 */
import { execSync } from "node:child_process";

const message = process.argv.slice(2).join(" ").trim() || "Deploy site update";

execSync("npm run publish", { stdio: "inherit" });

const filesToStage = ["index.html", "404.html", "assets/", "src/"];
execSync(`git add ${filesToStage.map((f) => `"${f}"`).join(" ")}`, {
  stdio: "inherit",
});

const staged = execSync("git diff --cached --name-only", { encoding: "utf8" }).trim();
if (!staged) {
  console.log("\nNothing to commit — site files already match the latest build.\n");
  process.exit(0);
}

execSync(`git commit -m ${JSON.stringify(message)}`, { stdio: "inherit" });

console.log("\n✓ Site committed locally.");
console.log("  Push to GitHub: git push origin main");
console.log("  Or ask Cursor to push once signed in as symesy9.\n");
