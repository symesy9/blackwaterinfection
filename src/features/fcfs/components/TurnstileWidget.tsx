import { useCallback, useEffect, useRef } from "react";
import { getTurnstileSiteKey } from "../lib/turnstileConfig";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileWidgetProps {
  resetKey?: number;
  onToken: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }

  const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile failed to load")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(script);
  });
}

export default function TurnstileWidget({
  resetKey = 0,
  onToken,
  onExpire,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = getTurnstileSiteKey();

  const handleToken = useCallback(
    (token: string) => {
      onToken(token);
    },
    [onToken],
  );

  const handleExpire = useCallback(() => {
    onExpire();
  }, [onExpire]);

  const handleError = useCallback(() => {
    onError();
  }, [onError]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      return;
    }

    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) {
        return;
      }

      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: handleToken,
        "expired-callback": handleExpire,
        "error-callback": handleError,
        theme: "dark",
      });
    };

    void loadTurnstileScript()
      .then(() => {
        if (!cancelled) {
          renderWidget();
        }
      })
      .catch(() => {
        handleError();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, resetKey, handleToken, handleExpire, handleError]);

  if (!siteKey) {
    return (
      <p className="fcfs-form__field-error" role="alert">
        Security check unavailable. FCFS applications are temporarily unavailable.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="cf-turnstile fcfs-form__turnstile"
      data-action="turnstile-spin-v1"
    />
  );
}
