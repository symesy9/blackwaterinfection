import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AddFcfsPanel from "../features/fcfs/components/AddFcfsPanel";
import CopyWalletIconButton from "../features/fcfs/components/CopyWalletIconButton";
import FcfsApplicationDetailModal from "../features/fcfs/components/FcfsApplicationDetailModal";
import FcfsAuditFlags from "../features/fcfs/components/FcfsAuditFlags";
import FcfsPagination from "../features/fcfs/components/FcfsPagination";
import XHandleLink from "../features/fcfs/components/XHandleLink";
import { useFcfsAdminFilters } from "../features/fcfs/hooks/useFcfsAdminFilters";
import {
  approvedWalletsToCsv,
  downloadCsv,
  fcfsApplicationsToCsv,
  fcfsExportFilename,
} from "../features/fcfs/lib/csv";
import {
  approveAllPendingFcfsApplications,
  bulkSetFcfsManualReviewFlag,
  copyToClipboard,
  fetchAllFcfsApplicationsForExport,
  fetchFcfsApplicationsEnriched,
  getFcfsStats,
} from "../features/fcfs/lib/adminApi";
import {
  fcfsStatusLabel,
  formatDateTime,
  verificationStatus,
} from "../features/fcfs/lib/format";
import type {
  FcfsApplicationEnriched,
  FcfsApplicationStatus,
  FcfsAuditFilter,
  FcfsSortField,
  FcfsStats,
  ManualReviewReason,
} from "../features/fcfs/lib/types";
import { shortenWalletAddress } from "../features/whitelist/lib/wallet";

const REVIEW_REASONS: ManualReviewReason[] = [
  "X ACCOUNT NOT FOUND",
  "VERY LOW ACTIVITY",
  "SUSPICIOUS HANDLE",
  "SUSPICIOUS SUBMISSION PATTERN",
  "WALLET ISSUE",
  "OTHER",
];

export default function AdminFcfsPage() {
  const { filters, setFilters } = useFcfsAdminFilters();
  const [applications, setApplications] = useState<FcfsApplicationEnriched[]>([]);
  const [total, setTotal] = useState(0);
  const [burstHiddenCount, setBurstHiddenCount] = useState(0);
  const [stats, setStats] = useState<FcfsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkReason, setBulkReason] = useState<ManualReviewReason>("OTHER");
  const [detail, setDetail] = useState<FcfsApplicationEnriched | null>(null);

  const pageSize = filters.pageSize ?? 25;

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchFcfsApplicationsEnriched(filters);
      setApplications(result.applications);
      setTotal(result.total);
      setBurstHiddenCount(result.burstHiddenCount);
    } catch {
      setError("Failed to load FCFS applications.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await getFcfsStats());
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
    if (!filters.selectedId) {
      setDetail(null);
      return;
    }
    const match = applications.find((app) => app.id === filters.selectedId);
    if (match) {
      setDetail(match);
    }
  }, [applications, filters.selectedId]);

  const refresh = () => {
    void loadApplications();
    void loadStats();
  };

  const openDetail = (application: FcfsApplicationEnriched) => {
    setFilters((current) => ({ ...current, selectedId: application.id }));
    setDetail(application);
  };

  const closeDetail = () => {
    setFilters((current) => ({ ...current, selectedId: null }));
    setDetail(null);
  };

  const handleCopy = async (application: FcfsApplicationEnriched) => {
    const ok = await copyToClipboard(application.wallet_address);
    if (ok) {
      setCopiedId(application.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === applications.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(applications.map((app) => app.id)));
  };

  const runBulkFlag = async (flagged: boolean) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    await bulkSetFcfsManualReviewFlag(ids, flagged, flagged ? bulkReason : null);
    setSelectedIds(new Set());
    refresh();
  };

  const runApproveAll = async () => {
    const pending = stats?.pending ?? 0;
    if (pending === 0) {
      setExportMessage("No pending FCFS applications to approve.");
      return;
    }
    if (
      !window.confirm(
        `Approve all ${pending} pending FCFS application${pending === 1 ? "" : "s"}?`,
      )
    ) {
      return;
    }
    setApprovingAll(true);
    setExportMessage("");
    setError("");
    try {
      const approved = await approveAllPendingFcfsApplications();
      setExportMessage(
        approved === 0
          ? "No pending FCFS applications to approve."
          : `Approved ${approved} application${approved === 1 ? "" : "s"}.`,
      );
      refresh();
    } catch {
      setError("Approve all failed. Please try again.");
    } finally {
      setApprovingAll(false);
    }
  };

  const runExport = async (kind: "all" | "filtered" | "approved" | "flagged") => {
    setExporting(true);
    setExportMessage("");
    try {
      const exportFilters =
        kind === "filtered" || kind === "flagged"
          ? {
              ...filters,
              auditFilter:
                kind === "flagged"
                  ? ("flagged" as FcfsAuditFilter)
                  : filters.auditFilter,
              page: 1,
            }
          : { page: 1, pageSize: 100 };

      const all = await fetchAllFcfsApplicationsForExport(exportFilters);

      if (kind === "approved") {
        const csv = approvedWalletsToCsv(all);
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

      downloadCsv(
        fcfsExportFilename(kind === "all" ? "all" : "filtered"),
        fcfsApplicationsToCsv(all),
      );
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
          <p className="wl-admin__muted">
            <Link to="/admin/fcfs/audit">Open FCFS Audit →</Link>
            {" · "}
            <Link to="/admin/fcfs/wallet-audit">Wallet Audit →</Link>
          </p>
        </div>
        <div className="wl-admin__header-actions">
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--primary"
            disabled={approvingAll || (stats?.pending ?? 0) === 0}
            onClick={() => void runApproveAll()}
          >
            {approvingAll
              ? "Approving all…"
              : `Approve All${stats ? ` (${stats.pending})` : ""}`}
          </button>
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
            onClick={() => void runExport("filtered")}
          >
            Export Current Filter
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            disabled={exporting}
            onClick={() => void runExport("flagged")}
          >
            Export Flagged
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
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={() => setShowAdd(true)}
          >
            Add Application
          </button>
        </div>
      </div>

      {exportMessage ? <p className="wl-admin__message">{exportMessage}</p> : null}

      <div className="wl-admin__filters">
        <input
          className="wl-admin__field-input"
          type="search"
          placeholder="Search wallet (0x…) or X handle (@user)…"
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
              status: event.target.value as FcfsApplicationStatus | "all",
              page: 1,
            }))
          }
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          className="wl-admin__field-input"
          value={filters.auditFilter ?? "all"}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              auditFilter: event.target.value as FcfsAuditFilter,
              page: 1,
              burstStart: null,
              burstEnd: null,
              xHandleNormalised: null,
            }))
          }
        >
          <option value="all">All audit filters</option>
          <option value="flagged">Flagged for review</option>
          <option value="no_flags">No flags</option>
          <option value="manual_review">Manual review flag</option>
          <option value="duplicate_x_handle">Duplicate X handle</option>
          <option value="duplicate_wallet">Exact wallet duplicate</option>
          <option value="already_on_whitelist">Already on WL</option>
          <option value="invalid_wallet">Invalid wallet format</option>
          <option value="malformed_x_handle">Malformed X handle</option>
          <option value="submission_burst">Submission burst</option>
        </select>
        <select
          className="wl-admin__field-input"
          value={`${filters.sortBy ?? "submitted_at"}:${filters.sortDir ?? "desc"}`}
          onChange={(event) => {
            const [sortBy, sortDir] = event.target.value.split(":");
            setFilters((current) => ({
              ...current,
              sortBy: sortBy as FcfsSortField,
              sortDir: sortDir as "asc" | "desc",
              page: 1,
            }));
          }}
        >
          <option value="submitted_at:desc">Submission — Newest First</option>
          <option value="submitted_at:asc">Submission — Oldest First</option>
          <option value="x_handle:asc">X Handle — A to Z</option>
          <option value="x_handle:desc">X Handle — Z to A</option>
          <option value="wallet:asc">Wallet — A to Z</option>
          <option value="wallet:desc">Wallet — Z to A</option>
          <option value="status:asc">Status</option>
        </select>
      </div>

      <div className="wl-admin__filter-toggle">
        <label className="wl-admin__filter-check">
          <input
            type="checkbox"
            checked={Boolean(filters.hideBursts)}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                hideBursts: event.target.checked,
                page: 1,
              }))
            }
          />
          <span>Hide submission bursts</span>
        </label>
        {filters.hideBursts && burstHiddenCount > 0 ? (
          <span className="wl-admin__filter-toggle-note">
            {burstHiddenCount.toLocaleString()} burst application
            {burstHiddenCount === 1 ? "" : "s"} hidden
          </span>
        ) : null}
      </div>

      {selectedIds.size > 0 ? (
        <div className="wl-admin__bulk-bar">
          <span>{selectedIds.size} selected</span>
          <select
            className="wl-admin__field-input"
            value={bulkReason}
            onChange={(event) =>
              setBulkReason(event.target.value as ManualReviewReason)
            }
          >
            {REVIEW_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={() => void runBulkFlag(true)}
          >
            Flag for Review
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={() => void runBulkFlag(false)}
          >
            Clear Review Flag
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="wl-admin__error" role="alert">
          {error}
        </p>
      ) : null}

      <FcfsPagination
        page={filters.page ?? 1}
        pageSize={pageSize}
        total={total}
        onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
      />

      {loading ? (
        <p className="wl-admin__loading">Loading applications…</p>
      ) : (
        <div className="wl-admin__table-wrap">
          <table className="wl-admin__table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={
                      applications.length > 0 &&
                      selectedIds.size === applications.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>X Handle</th>
                <th>Wallet</th>
                <th>Audit</th>
                <th>Follow</th>
                <th>Share</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={8}>No applications found.</td>
                </tr>
              ) : (
                applications.map((application) => (
                  <tr
                    key={application.id}
                    className={
                      filters.selectedId === application.id ? "is-selected" : ""
                    }
                    onClick={() => openDetail(application)}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(application.id)}
                        aria-label={`Select ${application.x_handle}`}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleSelected(application.id)}
                      />
                    </td>
                    <td>
                      <XHandleLink handle={application.x_handle} />
                      {application.duplicate_x_handle_count > 1 ? (
                        <span className="wl-admin__badge wl-admin__badge--warn">
                          X handle used by {application.duplicate_x_handle_count}{" "}
                          wallets
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className="wl-admin__wallet-cell">
                        <code>{shortenWalletAddress(application.wallet_address)}</code>
                        <CopyWalletIconButton
                          copied={copiedId === application.id}
                          onCopy={() => void handleCopy(application)}
                        />
                      </span>
                    </td>
                    <td>
                      <FcfsAuditFlags flags={application.audit_flags} />
                    </td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <FcfsPagination
        page={filters.page ?? 1}
        pageSize={pageSize}
        total={total}
        onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
      />

      {detail ? (
        <FcfsApplicationDetailModal
          detail={detail}
          copied={copiedId === detail.id}
          onClose={closeDetail}
          onCopyWallet={() => void handleCopy(detail)}
          onUpdated={refresh}
        />
      ) : null}

      {showAdd ? (
        <AddFcfsPanel
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            refresh();
          }}
          onDuplicate={(application) => {
            setShowAdd(false);
            openDetail({
              ...application,
              audit_flags: [],
              duplicate_x_handle_count: 1,
              same_burst_count: 0,
              manual_review_flag: application.manual_review_flag ?? false,
              manual_review_reason: application.manual_review_reason ?? null,
            });
          }}
        />
      ) : null}
    </div>
  );
}
