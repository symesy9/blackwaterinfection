import { useMemo, useState, type FormEvent } from "react";
import { isSupabaseConfigured } from "../../whitelist/lib/supabase";
import { validateWalletInput } from "../../whitelist/lib/wallet";
import { BLACKWATER_PINNED_POST_URL, BLACKWATER_X_URL } from "../../../lib/blackwaterLinks";
import { submitFcfsApplication } from "../lib/publicApi";
import { validateXHandleInput } from "../lib/xHandle";

type FormPhase = "active" | "success" | "error";

export default function FcfsApplicationForm() {
  const [followOpenedAt, setFollowOpenedAt] = useState<string | null>(null);
  const [followConfirmedAt, setFollowConfirmedAt] = useState<string | null>(null);
  const [shareOpenedAt, setShareOpenedAt] = useState<string | null>(null);
  const [shareConfirmedAt, setShareConfirmedAt] = useState<string | null>(null);
  const [xHandle, setXHandle] = useState("");
  const [wallet, setWallet] = useState("");
  const [phase, setPhase] = useState<FormPhase>("active");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const walletValidation = useMemo(() => validateWalletInput(wallet), [wallet]);
  const handleValidation = useMemo(() => validateXHandleInput(xHandle), [xHandle]);

  const canApply =
    followOpenedAt !== null &&
    followConfirmedAt !== null &&
    shareOpenedAt !== null &&
    shareConfirmedAt !== null &&
    walletValidation.valid &&
    handleValidation.valid &&
    !submitting;

  const openFollowLink = () => {
    setFollowOpenedAt(new Date().toISOString());
    window.open(BLACKWATER_X_URL, "_blank", "noopener,noreferrer");
  };

  const openShareLink = () => {
    setShareOpenedAt(new Date().toISOString());
    window.open(BLACKWATER_PINNED_POST_URL, "_blank", "noopener,noreferrer");
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !canApply ||
      !followOpenedAt ||
      !followConfirmedAt ||
      !shareOpenedAt ||
      !shareConfirmedAt
    ) {
      return;
    }

    if (!isSupabaseConfigured()) {
      setPhase("error");
      setErrorMessage("FCFS applications are temporarily unavailable.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const result = await submitFcfsApplication({
        wallet_address: wallet,
        x_handle: xHandle,
        follow_opened_at: followOpenedAt,
        follow_confirmed_at: followConfirmedAt,
        share_opened_at: shareOpenedAt,
        share_confirmed_at: shareConfirmedAt,
      });

      if (result.outcome === "submitted") {
        setPhase("success");
        return;
      }

      if (result.outcome === "already_registered") {
        setPhase("error");
        setErrorMessage("WALLET ALREADY REGISTERED");
        return;
      }

      if (result.outcome === "rate_limited") {
        setPhase("error");
        setErrorMessage("Too many attempts. Please wait a moment and try again.");
        return;
      }

      setPhase("error");
      setErrorMessage("Unable to submit application. Check your details and try again.");
    } catch {
      setPhase("error");
      setErrorMessage("Unable to submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "success") {
    return (
      <div className="fcfs-form fcfs-form--success">
        <p className="fcfs-form__success-eyebrow">TRANSMISSION LOGGED</p>
        <h2 className="fcfs-form__success-title">APPLICATION RECEIVED</h2>
        <p className="fcfs-form__success-lead">FCFS CLEARANCE PENDING</p>
        <p className="fcfs-form__success-copy">
          Your FCFS application is under review. Approval provides mint eligibility only —
          supply remains first come, first served.
        </p>
      </div>
    );
  }

  return (
    <form className="fcfs-form" onSubmit={(event) => void onSubmit(event)} noValidate>
      <ol className="fcfs-form__steps">
        <li className="fcfs-form__step">
          <div className="fcfs-form__step-head">
            <span className="fcfs-form__step-num">01</span>
            <h2 className="fcfs-form__step-title">Follow Blackwater</h2>
          </div>
          <p className="fcfs-form__step-copy">
            Open the official Blackwater profile on X, then confirm you are following.
          </p>
          <button
            type="button"
            className="fcfs-form__link-btn"
            onClick={openFollowLink}
          >
            Open Blackwater on X
          </button>
          <label className="fcfs-form__check">
            <input
              type="checkbox"
              checked={followConfirmedAt !== null}
              disabled={!followOpenedAt}
              onChange={(event) =>
                setFollowConfirmedAt(
                  event.target.checked ? new Date().toISOString() : null,
                )
              }
            />
            <span>I am following Blackwater on X</span>
          </label>
        </li>

        <li className="fcfs-form__step">
          <div className="fcfs-form__step-head">
            <span className="fcfs-form__step-num">02</span>
            <h2 className="fcfs-form__step-title">Share / Repost</h2>
          </div>
          <p className="fcfs-form__step-copy">
            Open the official post, share or repost it, then confirm below.
          </p>
          <button
            type="button"
            className="fcfs-form__link-btn"
            onClick={openShareLink}
          >
            Open Post on X
          </button>
          <label className="fcfs-form__check">
            <input
              type="checkbox"
              checked={shareConfirmedAt !== null}
              disabled={!shareOpenedAt}
              onChange={(event) =>
                setShareConfirmedAt(
                  event.target.checked ? new Date().toISOString() : null,
                )
              }
            />
            <span>I have shared/reposted the official post</span>
          </label>
        </li>

        <li className="fcfs-form__step">
          <div className="fcfs-form__step-head">
            <span className="fcfs-form__step-num">03</span>
            <h2 className="fcfs-form__step-title">X Handle</h2>
          </div>
          <label className="fcfs-form__label" htmlFor="fcfs-x-handle">
            Your X username
          </label>
          <input
            id="fcfs-x-handle"
            className="fcfs-form__input"
            type="text"
            inputMode="text"
            autoComplete="username"
            placeholder="@username"
            value={xHandle}
            onChange={(event) => setXHandle(event.target.value)}
          />
          {xHandle.trim() && !handleValidation.valid ? (
            <p className="fcfs-form__field-error" role="alert">
              {handleValidation.error}
            </p>
          ) : null}
        </li>

        <li className="fcfs-form__step">
          <div className="fcfs-form__step-head">
            <span className="fcfs-form__step-num">04</span>
            <h2 className="fcfs-form__step-title">ETH Wallet</h2>
          </div>
          <label className="fcfs-form__label" htmlFor="fcfs-wallet">
            Public Ethereum wallet address
          </label>
          <input
            id="fcfs-wallet"
            className="fcfs-form__input"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
          />
          {wallet.trim() && !walletValidation.valid ? (
            <p className="fcfs-form__field-error" role="alert">
              {walletValidation.error}
            </p>
          ) : null}
          <p className="fcfs-form__security">
            Only enter your public Ethereum wallet address. Blackwater will never ask for
            your seed phrase or private key.
          </p>
        </li>
      </ol>

      <div className="fcfs-form__info">
        <p>
          Approved FCFS wallets may mint up to <strong>2 NFTs per wallet</strong>.
        </p>
        <p>
          Application approval provides eligibility only and does not reserve supply or
          guarantee a mint. FCFS remains first come, first served and subject to remaining
          supply.
        </p>
      </div>

      {phase === "error" && errorMessage ? (
        <p className="fcfs-form__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        className="fcfs-form__apply"
        disabled={!canApply}
      >
        {submitting ? "Submitting…" : "Apply for FCFS →"}
      </button>
    </form>
  );
}
