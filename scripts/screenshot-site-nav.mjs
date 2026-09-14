import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "screenshots/site-nav-v1");
const baseUrl = process.env.SCREENSHOT_URL ?? "http://localhost:5173/";

const pages = [
  { name: "desktop-sidebar", path: "/", viewport: { width: 1440, height: 900 } },
  { name: "mobile-menu", path: "/", viewport: { width: 390, height: 844 }, openMenu: true },
  { name: "team", path: "/team", viewport: { width: 1440, height: 900 } },
  { name: "team-mobile", path: "/team", viewport: { width: 390, height: 844 } },
  { name: "roadmap", path: "/roadmap", viewport: { width: 1440, height: 900 } },
  { name: "roadmap-mobile", path: "/roadmap", viewport: { width: 430, height: 932 } },
  { name: "logs", path: "/logs", viewport: { width: 1440, height: 900 } },
  { name: "logs-tablet", path: "/logs", viewport: { width: 768, height: 1024 } },
  { name: "faqs", path: "/faqs", viewport: { width: 1440, height: 900 } },
  { name: "faqs-mobile", path: "/faqs", viewport: { width: 430, height: 932 } },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

for (const shot of pages) {
  await page.setViewportSize(shot.viewport);
  await page.goto(new URL(shot.path, baseUrl).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  if (shot.openMenu) {
    await page.click(".bw-home-nav__menu-btn");
    await page.waitForSelector(".bw-home-nav--drawer.is-open");
    await page.waitForTimeout(400);
  }

  const file = path.join(outDir, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
}

await browser.close();
