import { describe, expect, it } from "vitest";
import type { FcfsSubmissionPayload } from "../lib/publicApi";

describe("fcfs publicApi", () => {
  it("does not expose admin audit fields in public submission payload", () => {
    const payload: FcfsSubmissionPayload = {
      wallet_address: "0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3",
      x_handle: "@testuser",
      follow_opened_at: "2026-01-01T12:00:00.000Z",
      follow_confirmed_at: "2026-01-01T12:00:01.000Z",
      share_opened_at: "2026-01-01T12:00:02.000Z",
      share_confirmed_at: "2026-01-01T12:00:03.000Z",
    };

    expect(payload).not.toHaveProperty("manual_review_flag");
    expect(payload).not.toHaveProperty("audit_flags");
    expect(payload).not.toHaveProperty("internal_notes");
  });
});
