import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import {
  confirmAllUnconfirmedWallets,
  countUnconfirmedWallets,
  fetchWalletByNormalised,
  updateWallet,
} from "../lib/adminApi";
import {
  confirmationMethodLabel,
  formatDateTime,
  statusLabel,
} from "../lib/format";
import type { WhitelistWallet } from "../lib/types";
import {
  normaliseWalletAddress,
  shortenWalletAddress,
  validateWalletInput,
} from "../lib/wallet";

interface AdminWhitelistCheckerProps {
  onWalletsChanged: () => void;
}

export default function AdminWhitelistChecker({
  onWalletsChanged,
}: AdminWhitelistCheckerProps) {
  const inputId = useId();
  const statusId = useId();
  const [address, setAddress] = useState("");
  const [checking, setChecking] = useState(false);
  const [allowing, setAllowing] = useState(false);
  const [allowingAll, setAllowingAll] = useState(false);
  const [unconfirmedCount, setUnconfirmedCount] = useState<number | null>(null);
  const [result, setResult] = useState<WhitelistWallet | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadUnconfirmedCount = useCallback(async () => {
    try {
      setUnconfirmedCount(await countUnconfirmedWallets());
    } catch {
      setUnconfirmedCount(null);
    }
  }, []);

  useEffect(() => {
    void loadUnconfirmedCount();
  }, [loadUnconfirmedCount]);

  const runCheck = async (event?: FormEvent) => {
    event?.preventDefault();
    setError("");
    setMessage("");

    const validation = validateWalletInput(address);
    if (!validation.valid) {
      setResult(null);
      setError(validation.error ?? "Invalid address.");
      return;
    }

    setChecking(true);
    try {
      const wallet = await fetchWalletByNormalised(
        normaliseWalletAddress(address),
      );
      setResult(wallet);
      if (!wallet) {
        setError("Wallet not found on the whitelist.");
      } else if (!wallet.is_active || wallet.status === "removed") {
        setError("Wallet exists but is inactive or removed.");
      }
    } catch {
      setResult(null);
      setError("Lookup failed. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const allowWallet = async (wallet: WhitelistWallet) => {
    if (
      !window.confirm(
        `Allow (confirm) ${shortenWalletAddress(wallet.wallet_address)} as admin?`,
      )
    ) {
      return;
    }

    setAllowing(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateWallet(
        wallet.id,
        {
          status: "confirmed",
          confirmation_method: "admin",
          confirmed_at: new Date().toISOString(),
        },
        "wallet_confirmed_admin",
      );
      setResult(updated);
      setMessage("Wallet allowed and marked confirmed.");
      onWalletsChanged();
      void loadUnconfirmedCount();
    } catch {
      setError("Failed to allow wallet.");
    } finally {
      setAllowing(false);
    }
  };

  const runAllowAll = async () => {
    const count = unconfirmedCount ?? 0;
    if (count === 0) {
      setMessage("No unconfirmed wallets to allow.");
      return;
    }

    if (
      !window.confirm(
        `Allow all ${count} unconfirmed wallet${count === 1 ? "" : "s"}? This marks each as confirmed (admin).`,
      )
    ) {
      return;
    }

    setAllowingAll(true);
    setError("");
    setMessage("");
    try {
      const confirmed = await confirmAllUnconfirmedWallets();
      setMessage(
        confirmed === 0
          ? "No unconfirmed wallets to allow."
          : `Allowed ${confirmed} wallet${confirmed === 1 ? "" : "s"}.`,
      );
      if (result && result.status === "unconfirmed") {
        setResult({ ...result, status: "confirmed" });
      }
      onWalletsChanged();
      void loadUnconfirmedCount();
    } catch {
      setError("Allow all failed. Please try again.");
    } finally {
      setAllowingAll(false);
    }
  };

  const canAllowResult =
    result !== null &&
    result.is_active &&
    result.status !== "confirmed" &&
    result.status !== "removed";

  return (
    <section className="wl-admin__section wl-admin__checker">
      <div className="wl-admin__checker-header">
        <div>
          <h2 className="wl-admin__section-title">WL Checker</h2>
          <p className="wl-admin__muted">
            Look up a wallet or allow all unconfirmed entries in one action.
          </p>
        </div>
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--primary"
          disabled={allowingAll || unconfirmedCount === 0}
          onClick={() => void runAllowAll()}
        >
          {allowingAll
            ? "Allowing all…"
            : `Allow All${unconfirmedCount !== null ? ` (${unconfirmedCount})` : ""}`}
        </button>
      </div>

      <form className="wl-admin__checker-form" onSubmit={(e) => void runCheck(e)}>
        <label className="wl-admin__field-label" htmlFor={inputId}>
          Wallet address
        </label>
        <div className="wl-admin__checker-row">
          <input
            id={inputId}
            className="wl-admin__field-input"
            type="text"
            value={address}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            disabled={checking || allowingAll}
            onChange={(event) => {
              setAddress(event.target.value);
              setError("");
              setMessage("");
            }}
          />
          <button
            type="submit"
            className="wl-admin__btn wl-admin__btn--ghost"
            disabled={checking || allowingAll || !address.trim()}
          >
            {checking ? "Checking…" : "Check"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="wl-admin__error" role="alert">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="wl-admin__success" role="status">
          {message}
        </p>
      ) : null}

      {result && !error ? (
        <div className="wl-admin__checker-result" aria-labelledby={statusId}>
          <h3 id={statusId} className="wl-admin__checker-result-title">
            {shortenWalletAddress(result.wallet_address)}
          </h3>
          <dl className="wl-admin__checker-result-grid">
            <div>
              <dt>Status</dt>
              <dd>{statusLabel(result.status)}</dd>
            </div>
            <div>
              <dt>Active</dt>
              <dd>{result.is_active ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Spots</dt>
              <dd>{result.wl_spots}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{result.source ?? "—"}</dd>
            </div>
            <div>
              <dt>Confirmed</dt>
              <dd>{formatDateTime(result.confirmed_at)}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{confirmationMethodLabel(result.confirmation_method)}</dd>
            </div>
          </dl>
          {canAllowResult ? (
            <button
              type="button"
              className="wl-admin__btn wl-admin__btn--ghost"
              disabled={allowing || allowingAll}
              onClick={() => void allowWallet(result)}
            >
              {allowing ? "Allowing…" : "Allow Wallet"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
