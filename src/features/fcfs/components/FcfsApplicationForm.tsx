import { useCallback, useMemo, useState, type FormEvent } from "react";
import { isSupabaseConfigured } from "../../whitelist/lib/supabase";
import { validateWalletInput } from "../../whitelist/lib/wallet";
import { BLACKWATER_PINNED_POST_URL, BLACKWATER_X_URL } from "../../../lib/blackwaterLinks";
import TurnstileWidget from "./TurnstileWidget";
import {
  FCFS_HONEYPOT_FIELD,
  submitFcfsApplication,
} from "../lib/publicApi";
import { fcfsSubmitErrorDisplay } from "../lib/submitErrors";
import { isTurnstileConfigured } from "../lib/turnstileConfig";
import { validateXHandleInput } from "../lib/xHandle";

type FormPhase = "active" | "success" | "error";

export default function FcfsApplicationForm() {
  const [followOpenedAt, setFollowOpenedAt] = useState<string | null>(null);
  const [followConfirmedAt, setFollowConfirmedAt] = useState<string | null>(null);
  const [shareOpenedAt, setShareOpenedAt] = useState<string | null>(null);
  const [shareConfirmedAt, setShareConfirmedAt] = useState<string | null>(null);
  const [xHandle, setXHandle] = useState("");
  const [wallet, setWallet] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [phase, setPhase] = useState<FormPhase>("active");
  const [errorTitle, setErrorTitle] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const walletValidation = useMemo(() => validateWalletInput(wallet), [wallet]);
  const handleValidation = useMemo(() => validateXHandleInput(xHandle), [xHandle]);
  const turnstileReady = isTurnstileConfigured();

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    setTurnstileResetKey((current) => current + 1);
  }, []);

  const canApply =
    followOpenedAt !== null &&
    followConfirmedAt !== null &&
    shareOpenedAt !== null &&
    shareConfirmedAt !== null &&
    walletValidation.valid &&
    handleValidation.valid &&
    turnstileToken !== null &&
    turnstileReady &&
    !submitting;

  const openFollowLink = () => {
    setFollowOpenedAt(new Date().toISOString());
    window.open(BLACKWATER_X_URL, "_blank", "noopener,noreferrer");
  };

  const openShareLink = () => {
    setShareOpenedAt(new Date().toISOString());
    window.open(BLACKWATER_PINNED_POST_URL, "_blank", "noopener,noreferrer");
  };

  const showSubmitError = (outcome: Parameters<typeof fcfsSubmitErrorDisplay>[0]) => {
    const display = fcfsSubmitErrorDisplay(outcome);
    setPhase("error");
    setErrorTitle(display?.title ?? "Unable to submit application");
    setErrorDetail(display?.detail ?? "Please try again.");
    resetTurnstile();
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !canApply ||
      !followOpenedAt ||
      !followConfirmedAt ||
      !shareOpenedAt ||
      !shareConfirmedAt ||
      !turnstileToken
    ) {
      return;
    }

    if (!isSupabaseConfigured()) {
      setPhase("error");
      setErrorTitle("FCFS applications are temporarily unavailable.");
      setErrorDetail("");
      return;
    }

    setSubmitting(true);
    setErrorTitle("");
    setErrorDetail("");

    try {
      const result = await submitFcfsApplication({
        wallet_address: wallet,
        x_handle: xHandle,
        follow_opened_at: followOpenedAt,
        follow_confirmed_at: followConfirmedAt,
        share_opened_at: shareOpenedAt,
        share_confirmed_at: shareConfirmedAt,
        turnstile_token: turnstileToken,
        [FCFS_HONEYPOT_FIELD]: honeypot,
      });

      if (result.outcome === "submitted") {
        setPhase("success");
        return;
      }

      showSubmitError(result.outcome);
    } catch {
      setPhase("error");
      setErrorTitle("Unable to submit application");
      setErrorDetail("Please try again.");
      resetTurnstile();
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
      <div className="fcfs-form__honeypot" aria-hidden="true">
        <label htmlFor="fcfs-company-website">Company website</label>
        <input
          id="fcfs-company-website"
          name={FCFS_HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

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

        <li className="fcfs-form__step fcfs-form__step--security">
          <div className="fcfs-form__step-head">
            <span className="fcfs-form__step-num">05</span>
            <h2 className="fcfs-form__step-title">Security Check</h2>
          </div>
          <p className="fcfs-form__step-copy">Verify human clearance before transmission.</p>
          <div className="fcfs-form__security-panel">
            <p className="fcfs-form__security-label">Verify human clearance</p>
            <TurnstileWidget
              resetKey={turnstileResetKey}
              onToken={setTurnstileToken}
              onExpire={resetTurnstile}
              onError={resetTurnstile}
            />
          </div>
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

      {phase === "error" && errorTitle ? (
        <div className="fcfs-form__error-block" role="alert">
          <p className="fcfs-form__error">{errorTitle}</p>
          {errorDetail ? (
            <p className="fcfs-form__error-detail">{errorDetail}</p>
          ) : null}
        </div>
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
