import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "screenshots/wallet-checker");
const baseUrl = process.env.SCREENSHOT_URL ?? "http://localhost:5175/";
const wallet = "0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3";

const scenarios = {
  empty: null,
  bothApproved: {
    outcome: "ok",
    wallet_address: wallet,
    whitelist: { found: true, status: "confirmed" },
    fcfs: { found: true, status: "approved" },
  },
  wlApprovedFcfsPending: {
    outcome: "ok",
    wallet_address: wallet,
    whitelist: { found: true, status: "confirmed" },
    fcfs: { found: true, status: "pending" },
  },
  fcfsApprovedOnly: {
    outcome: "ok",
    wallet_address: wallet,
    whitelist: { found: false },
    fcfs: { found: true, status: "approved" },
  },
  neitherFound: {
    outcome: "ok",
    wallet_address: wallet,
    whitelist: { found: false },
    fcfs: { found: false },
  },
};

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function mockClearance(payload) {
  await page.route("**/functions/v1/check-wallet-clearance", async (route) => {
    if (!payload) {
      await route.abort();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
}

async function capture(name, viewport, payload) {
  await page.unroute("**/functions/v1/check-wallet-clearance").catch(() => {});
  await mockClearance(payload);
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}wallet-checker`, { waitUntil: "networkidle" });

  if (payload) {
    await page.fill(".wl-checker__input", wallet);
    await page.click('button[type="submit"]');
    await page.waitForSelector(".wc-checker__cards", { timeout: 10000 });
    await page.waitForTimeout(400);
  }

  const outPath = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`saved ${outPath}`);
}

await capture("01-empty-desktop", { width: 1440, height: 900 }, scenarios.empty);
await capture("02-both-approved", { width: 1440, height: 900 }, scenarios.bothApproved);
await capture("03-wl-approved-fcfs-pending", { width: 1440, height: 900 }, scenarios.wlApprovedFcfsPending);
await capture("04-fcfs-approved-only", { width: 1440, height: 900 }, scenarios.fcfsApprovedOnly);
await capture("05-neither-found", { width: 1440, height: 900 }, scenarios.neitherFound);
await capture("06-mobile-390", { width: 390, height: 844 }, scenarios.bothApproved);

await browser.close();
