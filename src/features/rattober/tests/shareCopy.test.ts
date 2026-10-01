import { describe, expect, it } from "vitest";
import { BLACKWATER_PUBLIC_SITE_ORIGIN } from "../../../lib/blackwaterLinks";
import {
  RATTOBER_SHARE_CAPTION,
  rattoberShareTextWithUrl,
  rattoberShareUrl,
  xComposeIntentUrl,
} from "../config/shareCopy";

describe("Rattober share copy", () => {
  it("builds full tweet text with public URL and hashtag", () => {
    const text = rattoberShareTextWithUrl();
    expect(text).toContain(RATTOBER_SHARE_CAPTION);
    expect(text).toContain("#Rattober");
    expect(text).toContain(`${BLACKWATER_PUBLIC_SITE_ORIGIN}/rattober`);
    expect(text.indexOf("#Rattober")).toBeGreaterThan(text.indexOf("/rattober"));
  });

  it("uses production fallback URL when window is unavailable", () => {
    expect(rattoberShareUrl()).toBe(`${BLACKWATER_PUBLIC_SITE_ORIGIN}/rattober`);
  });

  it("URL-encodes X compose intent text", () => {
    const sample = "My Rattober Rat has escaped 🐀\n\nhttps://blackwater-labs.com/rattober\n\n#Rattober";
    const intent = xComposeIntentUrl(sample);
    expect(intent.startsWith("https://x.com/intent/tweet?text=")).toBe(true);
    const encoded = intent.slice("https://x.com/intent/tweet?text=".length);
    expect(decodeURIComponent(encoded)).toBe(sample);
  });
});
