import { useCallback, useEffect, useState } from "react";
import AddFcfsPanel from "../features/fcfs/components/AddFcfsPanel";
import {
  approvedWalletsToCsv,
  downloadCsv,
  fcfsApplicationsToCsv,
  fcfsExportFilename,
} from "../features/fcfs/lib/csv";
import {
  copyToClipboard,
  fetchAllFcfsApplicationsForExport,
  fetchDuplicateXHandles,
  fetchFcfsApplicationById,
  fetchFcfsApplications,
  getFcfsStats,
  setFcfsApplicationStatus,
  updateFcfsApplication,
  updateFcfsWalletAndHandle,
} from "../features/fcfs/lib/adminApi";
import {
  fcfsStatusLabel,
  formatDateTime,
  verificationStatus,
} from "../features/fcfs/lib/format";
import type {
  FcfsApplication,
  FcfsApplicationFilters,
  FcfsApplicationStatus,
  FcfsStats,
} from "../features/fcfs/lib/types";
import { sanitizeNotes } from "../features/whitelist/lib/sanitize";
import { shortenWalletAddress } from "../features/whitelist/lib/wallet";

const PAGE_SIZE = 25;

export default function AdminFcfsPage() {
  const [applications, setApplications] = useState<FcfsApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<FcfsStats | null>(null);
  const [duplicateHandles, setDuplicateHandles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<FcfsApplicationFilters>({
    page: 1,
    pageSize: PAGE_SIZE,
    sortBy: "submitted_at",
    sortDir: "desc",
    status: "all",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FcfsApplication | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [editWallet, setEditWallet] = useState("");
  const [editHandle, setEditHandle] = useState("");

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [result, dupes] = await Promise.all([
        fetchFcfsApplications(filters),
        fetchDuplicateXHandles(),
      ]);
      setApplications(result.applications);
      setTotal(result.total);
      setDuplicateHandles(dupes);
    } catch {
      setError("Failed to load FCFS applications.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadStats = useCallback(async () => {
    try {
      const data = await getFcfsStats();
      setStats(data);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    document.title = "FCFS Applications — Blackwater Labs Admin";
  }, []);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setEditWallet("");
      setEditHandle("");
      return;
    }

    void fetchFcfsApplicationById(selectedId).then((app) => {
      setDetail(app);
      if (app) {
        setEditWallet(app.wallet_address);
        setEditHandle(app.x_handle);
      }
    });
  }, [selectedId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleCopy = async (application: FcfsApplication) => {
    const ok = await copyToClipboard(application.wallet_address);
    if (ok) {
      setCopiedId(application.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleStatusChange = async (status: FcfsApplicationStatus) => {
    if (!detail) return;
    if (!window.confirm(`Change status to "${fcfsStatusLabel(status)}"?`)) return;

    const updated = await setFcfsApplicationStatus(detail.id, status);
    setDetail(updated);
    void loadApplications();
    void loadStats();
  };

  const handleSaveNotes = async (notes: string) => {
    if (!detail) return;
    const updated = await updateFcfsApplication(detail.id, {
      internal_notes: sanitizeNotes(notes),
    });
    setDetail(updated);
  };

  const handleSaveIdentity = async () => {
    if (!detail) return;
    try {
      const updated = await updateFcfsWalletAndHandle(
        detail.id,
        editWallet,
        editHandle,
      );
      setDetail(updated);
      void loadApplications();
      void loadStats();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const runExport = async (kind: "all" | "approved") => {
    setExporting(true);
    setExportMessage("");
    try {
      const all = await fetchAllFcfsApplicationsForExport();
      const csv =
        kind === "approved" ? approvedWalletsToCsv(all) : fcfsApplicationsToCsv(all);

      if (kind === "approved") {
        const approvedCount = all.filter((app) => app.status === "approved").length;
        if (approvedCount === 0) {
          setExportMessage("No approved wallets to export.");
          return;
        }
        downloadCsv(fcfsExportFilename("approved"), csv);
        setExportMessage(`Exported ${approvedCount} approved wallets.`);
        return;
      }

      if (all.length === 0) {
        setExportMessage("No applications to export.");
        return;
      }

      downloadCsv(fcfsExportFilename("all"), csv);
      setExportMessage(`Exported ${all.length} applications.`);
    } catch {
      setExportMessage("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="wl-admin-wallets">
      <div className="wl-admin__page-header">
        <div>
          <h1 className="wl-admin__page-title">FCFS Applications</h1>
          <p className="wl-admin__page-lead">
            {stats
              ? `${stats.total} total · ${stats.pending} pending · ${stats.approved} approved · ${stats.rejected} rejected`
              : `${total} records matching filters`}
          </p>
        </div>
        <div className="wl-admin__header-actions">
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            disabled={exporting}
            onClick={() => void runExport("all")}
          >
            Export All
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            disabled={exporting}
            onClick={() => void runExport("approved")}
          >
            Export Approved Wallets
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--primary"
            onClick={() => setShowAdd(true)}
          >
            Add Application
          </button>
        </div>
      </div>

      {exportMessage ? (
        <p className="wl-admin__message">{exportMessage}</p>
      ) : null}

      <div className="wl-admin__filters">
        <input
          className="wl-admin__field-input"
          type="search"
          placeholder="Search X handle or wallet…"
          value={filters.search ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              search: event.target.value,
              page: 1,
            }))
          }
        />
        <select
          className="wl-admin__field-input"
          value={filters.status ?? "all"}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              status: event.target.value as FcfsApplicationFilters["status"],
              page: 1,
            }))
          }
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {error ? (
        <p className="wl-admin__error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="wl-admin__loading">Loading applications…</p>
      ) : (
        <div className="wl-admin__table-wrap">
          <table className="wl-admin__table">
            <thead>
              <tr>
                <th>X Handle</th>
                <th>Wallet</th>
                <th>Follow</th>
                <th>Share</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => {
                const duplicateHandle = duplicateHandles.has(
                  application.x_handle_normalised,
                );

                return (
                  <tr
                    key={application.id}
                    className={selectedId === application.id ? "is-selected" : ""}
                    onClick={() => setSelectedId(application.id)}
                  >
                    <td>
                      {application.x_handle}
                      {duplicateHandle ? (
                        <span className="wl-admin__badge wl-admin__badge--warn">
                          duplicate handle
                        </span>
                      ) : null}
                    </td>
                    <td>{shortenWalletAddress(application.wallet_address)}</td>
                    <td>
                      {verificationStatus(
                        application.follow_opened_at,
                        application.follow_confirmed_at,
                      )}
                    </td>
                    <td>
                      {verificationStatus(
                        application.share_opened_at,
                        application.share_confirmed_at,
                      )}
                    </td>
                    <td>{formatDateTime(application.submitted_at)}</td>
                    <td>
                      <span
                        className={`wl-admin__status wl-admin__status--${application.status}`}
                      >
                        {fcfsStatusLabel(application.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="wl-admin__pagination">
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--ghost"
          disabled={(filters.page ?? 1) <= 1}
          onClick={() =>
            setFilters((current) => ({
              ...current,
              page: Math.max(1, (current.page ?? 1) - 1),
            }))
          }
        >
          Previous
        </button>
        <span className="wl-admin__pagination-label">
          Page {filters.page ?? 1} of {totalPages}
        </span>
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--ghost"
          disabled={(filters.page ?? 1) >= totalPages}
          onClick={() =>
            setFilters((current) => ({
              ...current,
              page: Math.min(totalPages, (current.page ?? 1) + 1),
            }))
          }
        >
          Next
        </button>
      </div>

      {detail ? (
        <div
          className="wl-admin__modal-backdrop"
          role="presentation"
          onClick={() => setSelectedId(null)}
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
            </dl>

            <label className="wl-admin__field-label" htmlFor="fcfs-edit-handle">
              X handle
            </label>
            <input
              id="fcfs-edit-handle"
              className="wl-admin__field-input"
              value={editHandle}
              onChange={(event) => setEditHandle(event.target.value)}
            />

            <label className="wl-admin__field-label" htmlFor="fcfs-edit-wallet">
              Wallet address
            </label>
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
                onClick={() => void handleCopy(detail)}
              >
                {copiedId === detail.id ? "Copied" : "Copy Wallet"}
              </button>
              <button
                type="button"
                className="wl-admin__btn wl-admin__btn--ghost"
                onClick={() => void handleSaveIdentity()}
              >
                Save Handle / Wallet
              </button>
            </div>

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
                onClick={() => setSelectedId(null)}
              >
                Close
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
      ) : null}

      {showAdd ? (
        <AddFcfsPanel
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            void loadApplications();
            void loadStats();
          }}
          onDuplicate={(application) => {
            setShowAdd(false);
            setSelectedId(application.id);
          }}
        />
      ) : null}
    </div>
  );
}
