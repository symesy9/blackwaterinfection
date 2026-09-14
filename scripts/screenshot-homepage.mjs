import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "screenshots/homepage-v8");
const baseUrl = process.env.SCREENSHOT_URL ?? "http://localhost:5175/";

const viewports = [
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForSelector(".bw-home__layer--master", { state: "visible" });
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const master = document.querySelector(".bw-home__layer--master");
    const wordmark = document.querySelector(".bw-home__layer--wordmark");
    const hero = document.querySelector(".bw-home__hero");
    const panel = document.querySelector(".bw-home__panel");
    const cta = document.querySelector(".bw-home__cta");
    const copy = document.querySelector(".bw-home__copy");
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        width: Math.round(r.width),
        height: Math.round(r.height),
        top: Math.round(r.top),
        left: Math.round(r.left),
        bottom: Math.round(r.bottom),
      };
    };
    const visible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    };
    const vh = window.innerHeight;
    const inViewport = (el) => {
      const r = rect(el);
      if (!r) return false;
      return r.top >= 0 && r.bottom <= vh;
    };
    return {
      viewportHeight: vh,
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
      hero: rect(hero),
      master: rect(master),
      wordmark: rect(wordmark),
      projectInfo: rect(copy),
      cta: rect(cta),
      panel: rect(panel),
      allInViewport: {
        master: inViewport(master),
        wordmark: inViewport(wordmark),
        projectInfo: inViewport(copy),
        cta: inViewport(cta),
      },
      documentScrollHeight: document.documentElement.scrollHeight,
      assets: {
        atmosphere: visible(document.querySelector(".bw-home__layer--atmosphere")),
        wordmark: visible(wordmark),
        master: visible(master),
        rat: visible(document.querySelector(".bw-home__layer--rat")),
        jar: visible(document.querySelector(".bw-home__layer--jar")),
        classified: visible(document.querySelector(".bw-home__layer--classified")),
        spill: visible(document.querySelector(".bw-home__layer--spill")),
        lab: visible(document.querySelector(".bw-home__layer--lab")),
      },
    };
  });

  const outPath = path.join(outDir, `homepage-${vp.name}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(JSON.stringify({ viewport: vp.name, outPath, metrics }, null, 2));
}

await browser.close();
