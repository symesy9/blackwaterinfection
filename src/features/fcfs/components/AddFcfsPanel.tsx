import { useState, type FormEvent } from "react";
import { fetchFcfsPreInsertAudit, createFcfsManualRpc } from "../../clearance/lib/adminApi";
import type { FcfsPreInsertAudit } from "../../clearance/lib/types";
import { sanitizeNotes } from "../../whitelist/lib/sanitize";
import { validateWalletInput } from "../../whitelist/lib/wallet";
import type { FcfsApplication, FcfsApplicationStatus } from "../lib/types";
import { validateXHandleInput } from "../lib/xHandle";

interface AddFcfsPanelProps {
  onClose: () => void;
  onCreated: () => void;
  onDuplicate: (application: FcfsApplication) => void;
}

export default function AddFcfsPanel({
  onClose,
  onCreated,
}: AddFcfsPanelProps) {
  const [wallet, setWallet] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [status, setStatus] = useState<FcfsApplicationStatus>("pending");
  const [notes, setNotes] = useState("");
  const [audit, setAudit] = useState<FcfsPreInsertAudit | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const runAudit = async () => {
    setError("");
    const walletValidation = validateWalletInput(wallet);
    if (!walletValidation.valid) {
      setError(walletValidation.error ?? "Invalid wallet.");
      setAudit(null);
      return;
    }
    const handleValidation = validateXHandleInput(xHandle);
    if (!handleValidation.valid) {
      setError(handleValidation.error ?? "Invalid X handle.");
      setAudit(null);
      return;
    }
    setSubmitting(true);
    try {
      setAudit(await fetchFcfsPreInsertAudit(wallet, xHandle));
    } catch {
      setError("Pre-insert audit failed.");
      setAudit(null);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!audit?.can_insert) {
      await runAudit();
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await createFcfsManualRpc({
        wallet,
        xHandle,
        status,
        notes: sanitizeNotes(notes) || null,
      });
      if (result.outcome === "blocked") {
        setError("Insertion blocked by duplicate protection.");
        return;
      }
      if (result.outcome !== "ok") {
        setError("Failed to add FCFS application.");
        return;
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wl-admin__modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="wl-admin__modal"
        role="dialog"
        aria-labelledby="add-fcfs-title"
        onSubmit={(event) => void onSubmit(event)}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="add-fcfs-title" className="wl-admin__modal-title">
          Add FCFS Application
        </h2>

        <label className="wl-admin__field-label" htmlFor="add-fcfs-wallet">
          Wallet address
        </label>
        <input
          id="add-fcfs-wallet"
          className="wl-admin__field-input"
          value={wallet}
          onChange={(event) => {
            setWallet(event.target.value);
            setAudit(null);
          }}
          required
        />

        <label className="wl-admin__field-label" htmlFor="add-fcfs-handle">
          X handle
        </label>
        <input
          id="add-fcfs-handle"
          className="wl-admin__field-input"
          value={xHandle}
          onChange={(event) => {
            setXHandle(event.target.value);
            setAudit(null);
          }}
          placeholder="@username"
          required
        />

        <label className="wl-admin__field-label" htmlFor="add-fcfs-status">
          Status
        </label>
        <select
          id="add-fcfs-status"
          className="wl-admin__field-input"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as FcfsApplicationStatus)
          }
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <label className="wl-admin__field-label" htmlFor="add-fcfs-notes">
          Internal notes
        </label>
        <textarea
          id="add-fcfs-notes"
          className="wl-admin__field-textarea"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />

        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--ghost"
          disabled={submitting}
          onClick={() => void runAudit()}
        >
          Run pre-insert audit
        </button>

        {audit ? (
          <div className="wl-admin__card">
            <p>
              WL: <strong>{audit.whitelist?.exists ? "YES" : "NO"}</strong>
            </p>
            <p>
              FCFS wallet:{" "}
              <strong>{audit.fcfs_wallet?.exists ? "ALREADY EXISTS" : "NOT FOUND"}</strong>
            </p>
            <p>
              FCFS handle:{" "}
              <strong>{audit.fcfs_handle?.exists ? "ALREADY USED" : "NOT FOUND"}</strong>
            </p>
            {audit.crossover?.valid_crossover ? (
              <p className="wl-admin__badge">VALID WL + FCFS CROSSOVER</p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="wl-admin__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="wl-admin__modal-actions">
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="wl-admin__btn wl-admin__btn--primary"
            disabled={submitting || audit?.can_insert === false}
          >
            {submitting ? "Adding…" : audit?.can_insert ? "Add Application" : "Audit first"}
          </button>
        </div>
      </form>
    </div>
  );
}
