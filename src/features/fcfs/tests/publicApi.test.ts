import { beforeEach, describe, expect, it, vi } from "vitest";
import { FCFS_HONEYPOT_FIELD, submitFcfsApplication } from "../lib/publicApi";

vi.mock("../../whitelist/lib/supabase", () => ({
  invokeEdgeFunction: vi.fn(),
}));

import { invokeEdgeFunction } from "../../whitelist/lib/supabase";

const basePayload = {
  wallet_address: "0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3",
  x_handle: "@testuser",
  follow_opened_at: "2026-01-01T12:00:00.000Z",
  follow_confirmed_at: "2026-01-01T12:00:01.000Z",
  share_opened_at: "2026-01-01T12:00:02.000Z",
  share_confirmed_at: "2026-01-01T12:00:03.000Z",
  turnstile_token: "turnstile-token",
};

describe("fcfs publicApi", () => {
  beforeEach(() => {
    vi.mocked(invokeEdgeFunction).mockReset();
  });

  it("does not expose admin audit fields in public submission payload", () => {
    const payload = { ...basePayload };
    expect(payload).not.toHaveProperty("manual_review_flag");
    expect(payload).not.toHaveProperty("audit_flags");
    expect(payload).not.toHaveProperty("internal_notes");
  });

  it("rejects missing Turnstile token before calling the Edge Function", async () => {
    const result = await submitFcfsApplication({
      ...basePayload,
      turnstile_token: "",
    });
    expect(result.outcome).toBe("turnstile_failed");
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it("rejects invalid wallet before calling the Edge Function", async () => {
    const result = await submitFcfsApplication({
      ...basePayload,
      wallet_address: "not-a-wallet",
    });
    expect(result.outcome).toBe("invalid_wallet");
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it("rejects invalid x handle before calling the Edge Function", async () => {
    const result = await submitFcfsApplication({
      ...basePayload,
      x_handle: "bad handle",
    });
    expect(result.outcome).toBe("invalid_x_handle");
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it("sends Turnstile token and honeypot to the Edge Function", async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({ outcome: "submitted" });

    await submitFcfsApplication({
      ...basePayload,
      [FCFS_HONEYPOT_FIELD]: "",
    });

    expect(invokeEdgeFunction).toHaveBeenCalledWith(
      "submit-fcfs-application",
      expect.objectContaining({
        turnstile_token: "turnstile-token",
        [FCFS_HONEYPOT_FIELD]: "",
        follow_opened_at: basePayload.follow_opened_at,
        follow_confirmed_at: basePayload.follow_confirmed_at,
        share_opened_at: basePayload.share_opened_at,
        share_confirmed_at: basePayload.share_confirmed_at,
      }),
    );
  });

  it("does not send turnstileVerified flags to the Edge Function", async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({ outcome: "submitted" });

    await submitFcfsApplication(basePayload);

    const body = vi.mocked(invokeEdgeFunction).mock.calls.at(-1)?.[1];
    expect(body).not.toHaveProperty("turnstileVerified");
  });
});
