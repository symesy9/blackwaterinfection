import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { downloadRatBlob, openXComposeWithCaption, shareRatToX } from "../lib/shareRat";

vi.mock("../../../lib/mergeInfectionImage", () => ({
  downloadBlob: vi.fn(),
}));

import { downloadBlob } from "../../../lib/mergeInfectionImage";

describe("shareRatToX", () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads PNG and opens X compose with encoded caption", () => {
    const open = vi.fn(() => ({ closed: false }));
    vi.stubGlobal("window", {
      open,
      location: { origin: "http://localhost" },
    });

    const blob = new Blob(["png"], { type: "image/png" });
    const result = shareRatToX(blob, "RT-0001");

    expect(downloadBlob).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("https://x.com/intent/tweet?text="),
      "_blank",
      "noopener,noreferrer",
    );
    expect(result.composeOpened).toBe(true);
  });

  it("reports when pop-up is blocked", () => {
    vi.stubGlobal("window", {
      open: vi.fn(() => null),
      location: { origin: "http://localhost" },
    });
    const blob = new Blob(["png"], { type: "image/png" });
    expect(shareRatToX(blob).composeOpened).toBe(false);
    expect(downloadBlob).toHaveBeenCalledOnce();
  });
});

describe("openXComposeWithCaption", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when window.open is blocked", () => {
    vi.stubGlobal("window", {
      open: vi.fn(() => null),
      location: { origin: "http://localhost" },
    });
    expect(openXComposeWithCaption()).toBe(false);
  });

  it("returns false when window is unavailable", () => {
    vi.stubGlobal("window", undefined);
    expect(openXComposeWithCaption()).toBe(false);
  });
});

describe("downloadRatBlob", () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockClear();
  });

  it("delegates to download helper with rat filename", () => {
    downloadRatBlob(new Blob(["x"], { type: "image/png" }), "RT-0042");
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringMatching(/blackwater-rattober-rt-0042/),
    );
  });
});
