import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractTurnstileToken,
  isHoneypotTriggered,
  turnstileOutcomeFromVerify,
  verifyTurnstileToken,
  FCFS_HONEYPOT_FIELD,
} from "../../../../supabase/functions/submit-fcfs-application/verify.ts";
import { fcfsSubmitErrorDisplay } from "../lib/submitErrors";
import { getTurnstileSiteKey } from "../lib/turnstileConfig";

describe("fcfs submit security", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("accepts valid Turnstile verification", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await verifyTurnstileToken(
      "secret-key",
      "valid-token",
      "127.0.0.1",
      fetchMock as typeof fetch,
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects invalid Turnstile tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    });

    const result = await verifyTurnstileToken(
      "secret-key",
      "bad-token",
      undefined,
      fetchMock as typeof fetch,
    );

    expect(result).toEqual({ ok: false, reason: "failed" });
    expect(turnstileOutcomeFromVerify(result)).toBe("turnstile_failed");
  });

  it("rejects missing Turnstile tokens", async () => {
    const result = await verifyTurnstileToken("", "", undefined, vi.fn() as typeof fetch);
    expect(result).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects expired Turnstile tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        "error-codes": ["timeout-or-duplicate"],
      }),
    });

    const result = await verifyTurnstileToken(
      "secret-key",
      "expired-token",
      undefined,
      fetchMock as typeof fetch,
    );

    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(turnstileOutcomeFromVerify(result)).toBe("turnstile_expired");
  });

  it("fails closed when Cloudflare verification is unavailable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await verifyTurnstileToken(
      "secret-key",
      "token",
      undefined,
      fetchMock as typeof fetch,
    );

    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(turnstileOutcomeFromVerify(result)).toBe("error");
  });

  it("fails closed when secret key is missing", async () => {
    const result = await verifyTurnstileToken(
      "",
      "token",
      undefined,
      vi.fn() as typeof fetch,
    );

    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("does not expose secret keys client-side", () => {
    expect(getTurnstileSiteKey()).toBe("1x00000000000000000000AA");
    expect(import.meta.env).not.toHaveProperty("TURNSTILE_SECRET_KEY");
    expect(import.meta.env).not.toHaveProperty("VITE_TURNSTILE_SECRET_KEY");
  });

  it("allows empty honeypot through", () => {
    expect(isHoneypotTriggered({ [FCFS_HONEYPOT_FIELD]: "" })).toBe(false);
    expect(isHoneypotTriggered({})).toBe(false);
  });

  it("rejects populated honeypot", () => {
    expect(isHoneypotTriggered({ [FCFS_HONEYPOT_FIELD]: "https://spam.example" })).toBe(
      true,
    );
  });

  it("extracts turnstile token from request body", () => {
    expect(extractTurnstileToken({ turnstile_token: " abc " })).toBe("abc");
    expect(extractTurnstileToken({})).toBe("");
  });

  it("maps Turnstile failures to user-safe messages", () => {
    expect(fcfsSubmitErrorDisplay("turnstile_failed")).toEqual({
      title: "SECURITY CHECK FAILED",
      detail: "Please complete the security check and try again.",
    });
    expect(fcfsSubmitErrorDisplay("turnstile_expired")).toEqual({
      title: "SECURITY CHECK EXPIRED",
      detail: "Please verify again before submitting.",
    });
  });

  it("does not reveal honeypot blocks in user messaging", () => {
    expect(fcfsSubmitErrorDisplay("error")).toEqual({
      title: "Unable to submit application",
      detail: "Please try again.",
    });
  });
});
