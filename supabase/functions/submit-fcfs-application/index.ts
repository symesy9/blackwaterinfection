import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  extractTurnstileToken,
  isHoneypotTriggered,
  turnstileOutcomeFromVerify,
  verifyTurnstileToken,
} from "./verify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RATE_WINDOW_SECONDS = 60;
const RATE_MAX_REQUESTS = 5;

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function logFcfsSecurityEvent(
  supabase: ReturnType<typeof createClient>,
  eventType: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from("audit_events").insert({
    event_type: eventType,
    wallet_id: null,
    wallet_address_snapshot: null,
    event_source: "public",
    metadata,
  });

  if (error) {
    console.error("fcfs security audit log failed", eventType, error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ outcome: "error" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ outcome: "error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const clientIp = getClientIp(req);
    const body = (await req.json()) as Record<string, unknown>;

    if (isHoneypotTriggered(body)) {
      await logFcfsSecurityEvent(supabase, "fcfs_honeypot_blocked", {
        client_ip: clientIp,
      });
      return new Response(JSON.stringify({ outcome: "error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allowed, error: rateError } = await supabase.rpc(
      "check_rate_limit",
      {
        p_bucket_key: `submit-fcfs:${clientIp}`,
        p_window_seconds: RATE_WINDOW_SECONDS,
        p_max_requests: RATE_MAX_REQUESTS,
      },
    );

    if (rateError || !allowed) {
      await logFcfsSecurityEvent(supabase, "fcfs_rate_limited", {
        client_ip: clientIp,
      });
      return new Response(JSON.stringify({ outcome: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const turnstileResult = await verifyTurnstileToken(
      turnstileSecret,
      extractTurnstileToken(body),
      clientIp,
    );

    if (!turnstileResult.ok) {
      const outcome = turnstileOutcomeFromVerify(turnstileResult);
      await logFcfsSecurityEvent(supabase, "fcfs_turnstile_rejected", {
        client_ip: clientIp,
        reason: turnstileResult.reason,
      });
      return new Response(JSON.stringify({ outcome }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const walletAddress =
      typeof body?.wallet_address === "string" ? body.wallet_address : "";
    const xHandle = typeof body?.x_handle === "string" ? body.x_handle : "";
    const followOpenedAt = parseTimestamp(body?.follow_opened_at);
    const followConfirmedAt = parseTimestamp(body?.follow_confirmed_at);
    const shareOpenedAt = parseTimestamp(body?.share_opened_at);
    const shareConfirmedAt = parseTimestamp(body?.share_confirmed_at);

    const { data, error } = await supabase.rpc("public_submit_fcfs_application", {
      p_wallet_address: walletAddress,
      p_x_handle: xHandle,
      p_follow_opened_at: followOpenedAt,
      p_follow_confirmed_at: followConfirmedAt,
      p_share_opened_at: shareOpenedAt,
      p_share_confirmed_at: shareConfirmedAt,
    });

    if (error) {
      console.error("fcfs submit error", error);
      return new Response(JSON.stringify({ outcome: "error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = data as { outcome?: string };
    if (result.outcome === "already_registered") {
      await logFcfsSecurityEvent(supabase, "fcfs_duplicate_wallet_blocked", {
        client_ip: clientIp,
      });
    } else if (result.outcome === "x_handle_already_used") {
      await logFcfsSecurityEvent(supabase, "fcfs_x_handle_duplicate_blocked", {
        client_ip: clientIp,
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit-fcfs-application error", err);
    return new Response(JSON.stringify({ outcome: "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
