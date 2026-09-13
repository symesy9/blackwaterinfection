import { useState, type FormEvent } from "react";
import { sanitizeNotes } from "../../whitelist/lib/sanitize";
import { validateWalletInput } from "../../whitelist/lib/wallet";
import { createFcfsApplicationManual } from "../lib/adminApi";
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
  onDuplicate,
}: AddFcfsPanelProps) {
  const [wallet, setWallet] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [status, setStatus] = useState<FcfsApplicationStatus>("pending");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const walletValidation = validateWalletInput(wallet);
    if (!walletValidation.valid) {
      setError(walletValidation.error ?? "Invalid wallet.");
      return;
    }

    const handleValidation = validateXHandleInput(xHandle);
    if (!handleValidation.valid) {
      setError(handleValidation.error ?? "Invalid X handle.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createFcfsApplicationManual({
        wallet_address: wallet,
        x_handle: xHandle,
        status,
        internal_notes: sanitizeNotes(notes) || undefined,
      });

      if (result.duplicate && result.application) {
        setError("This wallet already has an FCFS application.");
        onDuplicate(result.application);
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
          onChange={(event) => setWallet(event.target.value)}
          required
        />

        <label className="wl-admin__field-label" htmlFor="add-fcfs-handle">
          X handle
        </label>
        <input
          id="add-fcfs-handle"
          className="wl-admin__field-input"
          value={xHandle}
          onChange={(event) => setXHandle(event.target.value)}
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
            disabled={submitting}
          >
            {submitting ? "Adding…" : "Add Application"}
          </button>
        </div>
      </form>
    </div>
  );
}
