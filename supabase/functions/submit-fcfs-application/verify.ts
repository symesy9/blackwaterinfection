export const FCFS_HONEYPOT_FIELD = "company_website";

export type TurnstileVerifyReason =
  | "missing"
  | "failed"
  | "expired"
  | "unavailable";

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; reason: TurnstileVerifyReason };

export function isHoneypotTriggered(body: Record<string, unknown>): boolean {
  const value = body[FCFS_HONEYPOT_FIELD];
  return typeof value === "string" && value.trim().length > 0;
}

export function extractTurnstileToken(body: Record<string, unknown>): string {
  const token = body.turnstile_token;
  return typeof token === "string" ? token.trim() : "";
}

const EXPIRED_TURNSTILE_CODES = new Set(["timeout-or-duplicate", "expired"]);

export async function verifyTurnstileToken(
  secret: string,
  token: string,
  remoteIp?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileVerifyResult> {
  if (!token) {
    return { ok: false, reason: "missing" };
  }

  if (!secret.trim()) {
    return { ok: false, reason: "unavailable" };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp && remoteIp !== "unknown") {
    form.set("remoteip", remoteIp);
  }

  try {
    const response = await fetchImpl(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );

    if (!response.ok) {
      return { ok: false, reason: "unavailable" };
    }

    const data = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (data.success) {
      return { ok: true };
    }

    const errorCodes = data["error-codes"] ?? [];
    if (errorCodes.some((code) => EXPIRED_TURNSTILE_CODES.has(code))) {
      return { ok: false, reason: "expired" };
    }

    return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function turnstileOutcomeFromVerify(
  result: TurnstileVerifyResult,
): "turnstile_failed" | "turnstile_expired" | "error" {
  if (result.ok) {
    return "error";
  }

  if (result.reason === "expired") {
    return "turnstile_expired";
  }

  if (result.reason === "missing" || result.reason === "failed") {
    return "turnstile_failed";
  }

  return "error";
}
