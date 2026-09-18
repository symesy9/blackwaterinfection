import { useState } from "react";
import { bulkDeletePhrase, canConfirmBulkDelete } from "../lib/bulkDeleteSafety";

type BulkDeleteConfirmModalProps = {
  title: string;
  count: number;
  filterDescription?: string;
  entityLabel?: string;
  actionVerb?: string;
  confirmButtonLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export default function BulkDeleteConfirmModal({
  title,
  count,
  filterDescription,
  entityLabel = "applications",
  actionVerb = "permanently delete",
  confirmButtonLabel = "Delete permanently",
  onConfirm,
  onCancel,
}: BulkDeleteConfirmModalProps) {
  const [phrase, setPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requiredPhrase = bulkDeletePhrase(count);
  const canConfirm = canConfirmBulkDelete(phrase, count) && !submitting;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wl-admin__modal-backdrop" role="presentation">
      <div
        className="wl-admin__modal"
        role="dialog"
        aria-labelledby="bulk-delete-title"
        aria-modal="true"
      >
        <h2 id="bulk-delete-title" className="wl-admin__modal-title">
          {title}
        </h2>
        <p>
          You are about to {actionVerb} <strong>{count}</strong> {entityLabel}.
        </p>
        {filterDescription ? (
          <p className="wl-admin__muted">Filter: {filterDescription}</p>
        ) : null}
        <p className="wl-admin__error">
          This cannot be undone through the admin interface.
        </p>
        <p>
          Type <code>{requiredPhrase}</code> to continue.
        </p>
        <input
          className="wl-admin__field-input"
          type="text"
          value={phrase}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setPhrase(event.target.value)}
        />
        <div className="wl-admin__modal-actions">
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--danger"
            disabled={!canConfirm}
            onClick={() => void handleConfirm()}
          >
            {submitting ? "Processing…" : confirmButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
