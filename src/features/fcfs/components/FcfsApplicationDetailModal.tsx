import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchFcfsRelatedCounts,
  setFcfsApplicationStatus,
  setFcfsManualReviewFlag,
  updateFcfsApplication,
  updateFcfsWalletAndHandle,
} from "../lib/adminApi";
import { fcfsFiltersToSearchParams } from "../hooks/useFcfsAdminFilters";
import {
  fcfsStatusLabel,
  formatDateTime,
  verificationStatus,
} from "../lib/format";
import type {
  FcfsApplicationEnriched,
  FcfsApplicationStatus,
  FcfsRelatedCounts,
  ManualReviewReason,
} from "../lib/types";
import { xProfileUrl } from "../lib/xHandle";
import { sanitizeNotes } from "../../whitelist/lib/sanitize";
import CopyWalletIconButton from "./CopyWalletIconButton";
import FcfsAuditFlags from "./FcfsAuditFlags";
import XHandleLink from "./XHandleLink";

const REVIEW_REASONS: ManualReviewReason[] = [
  "X ACCOUNT NOT FOUND",
  "VERY LOW ACTIVITY",
  "SUSPICIOUS HANDLE",
  "SUSPICIOUS SUBMISSION PATTERN",
  "WALLET ISSUE",
  "OTHER",
];

type FcfsApplicationDetailModalProps = {
  detail: FcfsApplicationEnriched;
  copied: boolean;
  onClose: () => void;
  onCopyWallet: () => void;
  onUpdated: () => void;
};

export default function FcfsApplicationDetailModal({
  detail,
  copied,
  onClose,
  onCopyWallet,
  onUpdated,
}: FcfsApplicationDetailModalProps) {
  const [editWallet, setEditWallet] = useState(detail.wallet_address);
  const [editHandle, setEditHandle] = useState(detail.x_handle ?? "");
  const [related, setRelated] = useState<FcfsRelatedCounts | null>(null);
  const [reviewReason, setReviewReason] = useState<ManualReviewReason>(
    (detail.manual_review_reason as ManualReviewReason) ?? "OTHER",
  );

  useEffect(() => {
    setEditWallet(detail.wallet_address);
    setEditHandle(detail.x_handle ?? "");
    setReviewReason(
      (detail.manual_review_reason as ManualReviewReason) ?? "OTHER",
    );
  }, [detail]);

  useEffect(() => {
    void fetchFcfsRelatedCounts(detail.id).then(setRelated);
  }, [detail.id]);

  const handleStatusChange = async (status: FcfsApplicationStatus) => {
    if (!window.confirm(`Change status to "${fcfsStatusLabel(status)}"?`)) return;
    await setFcfsApplicationStatus(detail.id, status);
    onUpdated();
  };

  const handleSaveIdentity = async () => {
    try {
      await updateFcfsWalletAndHandle(detail.id, editWallet, editHandle);
      onUpdated();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const handleSaveNotes = async (notes: string) => {
    await updateFcfsApplication(detail.id, {
      internal_notes: sanitizeNotes(notes),
    });
    onUpdated();
  };

  const handleManualFlag = async (flagged: boolean) => {
    await setFcfsManualReviewFlag(
      detail.id,
      flagged,
      flagged ? reviewReason : null,
    );
    onUpdated();
  };

  const xUrl = detail.x_handle ? xProfileUrl(detail.x_handle) : null;
  const sameHandleParams = detail.x_handle_normalised
    ? fcfsFiltersToSearchParams({
        xHandleNormalised: detail.x_handle_normalised,
        auditFilter: "duplicate_x_handle",
        page: 1,
      })
    : null;

  return (
    <div
      className="wl-admin__modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="wl-admin__modal wl-admin__modal--wide"
        role="dialog"
        aria-labelledby="fcfs-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="fcfs-detail-title" className="wl-admin__modal-title">
          FCFS Application
        </h2>

        <FcfsAuditFlags flags={detail.audit_flags} />

        <dl className="wl-admin__detail-grid">
          <div>
            <dt>Status</dt>
            <dd>{fcfsStatusLabel(detail.status)}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{formatDateTime(detail.submitted_at)}</dd>
          </div>
          <div>
            <dt>Follow</dt>
            <dd>
              {verificationStatus(
                detail.follow_opened_at,
                detail.follow_confirmed_at,
              )}
            </dd>
          </div>
          <div>
            <dt>Share</dt>
            <dd>
              {verificationStatus(
                detail.share_opened_at,
                detail.share_confirmed_at,
              )}
            </dd>
          </div>
          <div>
            <dt>Reviewed</dt>
            <dd>{formatDateTime(detail.reviewed_at)}</dd>
          </div>
          <div>
            <dt>Manual review</dt>
            <dd>
              {detail.manual_review_flag
                ? detail.manual_review_reason ?? "Flagged for review"
                : "Not flagged"}
            </dd>
          </div>
        </dl>

        <section className="wl-admin__detail-relations">
          <h3 className="wl-admin__field-label">Related records</h3>
          <dl className="wl-admin__detail-grid">
            <div>
              <dt>X handle</dt>
              <dd>
                {related?.x_handle_normalised ?? detail.x_handle_normalised
                  ? `@${related?.x_handle_normalised ?? detail.x_handle_normalised}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>FCFS applications using handle</dt>
              <dd>
                {sameHandleParams ? (
                  <Link to={`/admin/fcfs?${sameHandleParams.toString()}`}>
                    {related?.same_x_handle_count ?? detail.duplicate_x_handle_count}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>FCFS applications using exact wallet</dt>
              <dd>{related?.same_wallet_count ?? 1}</dd>
            </div>
            <div>
              <dt>Existing whitelist record</dt>
              <dd>
                {related?.on_whitelist ?? detail.already_on_whitelist
                  ? `YES${related?.whitelist_status ? ` (${related.whitelist_status})` : ""}`
                  : "NO"}
              </dd>
            </div>
            <div>
              <dt>Submission burst size</dt>
              <dd>
                {related?.same_burst_count ?? detail.same_burst_count ?? 0}
              </dd>
            </div>
          </dl>
          {(related?.related_x_handle_applications ?? []).length > 0 ? (
            <ul className="wl-admin__related-list">
              {related!.related_x_handle_applications.map((entry) => {
                const params = fcfsFiltersToSearchParams({
                  selectedId: entry.id,
                  page: 1,
                });
                return (
                  <li key={entry.id}>
                    <Link to={`/admin/fcfs?${params.toString()}`}>
                      {entry.wallet_address} · {fcfsStatusLabel(entry.status)} ·{" "}
                      {formatDateTime(entry.submitted_at)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <div className="wl-admin__modal-actions wl-admin__modal-actions--left">
          {xUrl ? (
            <a
              href={xUrl}
              className="wl-admin__btn wl-admin__btn--ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open X Profile
            </a>
          ) : null}
        </div>

        <label className="wl-admin__field-label" htmlFor="fcfs-edit-handle">
          X handle
        </label>
        <XHandleLink handle={detail.x_handle} />
        <input
          id="fcfs-edit-handle"
          className="wl-admin__field-input"
          value={editHandle}
          onChange={(event) => setEditHandle(event.target.value)}
        />

        <div className="wl-admin__field-label-row">
          <label className="wl-admin__field-label" htmlFor="fcfs-edit-wallet">
            Wallet address
          </label>
          <CopyWalletIconButton copied={copied} onCopy={onCopyWallet} />
        </div>
        <input
          id="fcfs-edit-wallet"
          className="wl-admin__field-input"
          value={editWallet}
          onChange={(event) => setEditWallet(event.target.value)}
        />

        <div className="wl-admin__modal-actions wl-admin__modal-actions--left">
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={() => void handleSaveIdentity()}
          >
            Save Handle / Wallet
          </button>
        </div>

        <label className="wl-admin__field-label" htmlFor="fcfs-review-reason">
          Manual review reason
        </label>
        <select
          id="fcfs-review-reason"
          className="wl-admin__field-select"
          value={reviewReason}
          onChange={(event) =>
            setReviewReason(event.target.value as ManualReviewReason)
          }
        >
          {REVIEW_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>

        <label className="wl-admin__field-label" htmlFor="fcfs-detail-notes">
          Internal notes
        </label>
        <textarea
          id="fcfs-detail-notes"
          className="wl-admin__field-textarea"
          rows={4}
          defaultValue={detail.internal_notes ?? ""}
          onBlur={(event) => void handleSaveNotes(event.target.value)}
        />

        <div className="wl-admin__modal-actions">
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={() => void handleManualFlag(true)}
          >
            Flag for Review
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={() => void handleManualFlag(false)}
          >
            Clear Flag
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--primary"
            onClick={() => void handleStatusChange("approved")}
          >
            Approve
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={() => void handleStatusChange("rejected")}
          >
            Reject
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={() => void handleStatusChange("pending")}
          >
            Return to Pending
          </button>
        </div>
      </div>
    </div>
  );
}
