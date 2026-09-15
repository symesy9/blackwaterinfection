import {
  useCallback,
  useId,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { confirmWalletPublic } from "../../whitelist/lib/publicApi";
import { isSupabaseConfigured } from "../../whitelist/lib/supabase";
import { shortenWalletAddress } from "../../whitelist/lib/wallet";
import { FCFS_ALLOCATION, MINT_PRICE, WL_ALLOCATION } from "../lib/mintRules";
import { checkWalletClearance } from "../lib/publicApi";
import type { ClearanceDisplay } from "../lib/types";
import CategoryClearanceCard from "./CategoryClearanceCard";

type CheckerPhase =
  | "idle"
  | "loading"
  | "result"
  | "invalid"
  | "error"
  | "rate_limited"
  | "confirming";

export default function WalletCheckerForm() {
  const inputId = useId();
  const statusId = useId();
  const [address, setAddress] = useState("");
  const [phase, setPhase] = useState<CheckerPhase>("idle");
  const [display, setDisplay] = useState<ClearanceDisplay | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const configured = isSupabaseConfigured();

  const runCheck = useCallback(async () => {
    setPhase("loading");
    setStatusMessage("");
    setDisplay(null);

    try {
      const result = await checkWalletClearance(address);

      if (result.outcome === "invalid_address") {
        setPhase("invalid");
        setStatusMessage("INVALID ETHEREUM WALLET ADDRESS");
        return;
      }

      if (result.outcome === "rate_limited") {
        setPhase("rate_limited");
        setStatusMessage("Too many requests. Please wait a moment and try again.");
        return;
      }

      if (result.outcome === "error") {
        setPhase("error");
        setStatusMessage("Unable to check wallet clearance right now. Please try again shortly.");
        return;
      }

      if (result.outcome === "ok") {
        setDisplay(result.display);
        setPhase("result");
      }
    } catch {
      setPhase("error");
      setStatusMessage("Network error. Check your connection and try again.");
    }
  }, [address]);

  const runConfirmWhitelist = useCallback(async () => {
    setPhase("confirming");
    setStatusMessage("Recording whitelist confirmation…");

    try {
      const result = await confirmWalletPublic(address);

      if (result.outcome === "confirmed" || result.outcome === "already_confirmed") {
        await runCheck();
        setStatusMessage("Whitelist confirmation recorded.");
        return;
      }

      if (result.outcome === "not_found") {
        setPhase("error");
        setStatusMessage("Wallet not found on the whitelist.");
        return;
      }

      if (result.outcome === "rate_limited") {
        setPhase("rate_limited");
        setStatusMessage("Too many confirmation attempts. Please wait.");
        return;
      }

      setPhase("error");
      setStatusMessage("Confirmation failed. Please try again.");
    } catch {
      setPhase("error");
      setStatusMessage("Network error during confirmation.");
    }
  }, [address, runCheck]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runCheck();
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runCheck();
    }
  };

  if (!configured) {
    return (
      <div className="wl-checker__panel">
        <p className="wl-checker__status wl-checker__status--error" role="alert">
          Wallet checker is not yet configured for this environment.
        </p>
      </div>
    );
  }

  const showConfirmWhitelist =
    display?.whitelist.canSelfConfirmWhitelist &&
    (phase === "result" || phase === "confirming");

  return (
    <div className="wl-checker wc-checker">
      <div className="wc-checker__rules" aria-label="Mint rules">
        <div className="wc-checker__rules-row">
          <span className="wc-checker__rules-label">MINT PRICE</span>
          <span className="wc-checker__rules-value">{MINT_PRICE}</span>
        </div>
        <div className="wc-checker__rules-row">
          <span className="wc-checker__rules-label">WHITELIST</span>
          <span className="wc-checker__rules-value">{WL_ALLOCATION}</span>
        </div>
        <div className="wc-checker__rules-row">
          <span className="wc-checker__rules-label">FCFS</span>
          <span className="wc-checker__rules-value">{FCFS_ALLOCATION}</span>
        </div>
      </div>

      <form className="wl-checker__form" onSubmit={onSubmit} noValidate>
        <label className="wl-checker__label" htmlFor={inputId}>
          Ethereum wallet
        </label>
        <input
          id={inputId}
          className="wl-checker__input"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="0x…"
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            if (phase !== "idle" && phase !== "loading") {
              setPhase("idle");
              setStatusMessage("");
              setDisplay(null);
            }
          }}
          onKeyDown={onInputKeyDown}
          aria-describedby={statusMessage ? statusId : undefined}
          aria-invalid={phase === "invalid"}
          disabled={phase === "loading" || phase === "confirming"}
        />

        <div className="wl-checker__actions">
          <button
            type="submit"
            className="wl-checker__btn wl-checker__btn--primary"
            disabled={
              phase === "loading" || phase === "confirming" || !address.trim()
            }
          >
            {phase === "loading" ? "Checking…" : "Check Wallet"}
          </button>

          {showConfirmWhitelist ? (
            <button
              type="button"
              className="wl-checker__btn wl-checker__btn--confirm"
              disabled={phase === "confirming"}
              onClick={() => void runConfirmWhitelist()}
            >
              {phase === "confirming"
                ? "Confirming…"
                : "Confirm Whitelist Place →"}
            </button>
          ) : null}
        </div>
      </form>

      {statusMessage ? (
        <div
          id={statusId}
          className={`wl-checker__status wl-checker__status--${phase}`}
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </div>
      ) : null}

      {display && phase === "result" ? (
        <div className="wc-checker__results" aria-label="Clearance results">
          {display.walletAddress ? (
            <p className="wc-checker__wallet">
              {shortenWalletAddress(display.walletAddress)}
            </p>
          ) : null}

          {display.headline ? (
            <p className="wc-checker__headline">{display.headline}</p>
          ) : null}

          <div className="wc-checker__cards">
            <CategoryClearanceCard clearance={display.whitelist} />
            <CategoryClearanceCard clearance={display.fcfs} />
          </div>

          <p className="wl-checker__disclaimer">
            Whitelist and FCFS are separate allocation categories. FCFS approval
            provides eligibility only — remaining supply is not guaranteed.
            Whitelist self-confirmation records acknowledgement; it does not
            cryptographically verify wallet ownership.
          </p>
        </div>
      ) : null}
    </div>
  );
}
