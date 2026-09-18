import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FcfsPagination from "../features/fcfs/components/FcfsPagination";
import BulkDeleteConfirmModal from "../features/clearance/components/BulkDeleteConfirmModal";
import BulkSelectionBar from "../features/clearance/components/BulkSelectionBar";
import { formatSelectionChangedMessage } from "../features/clearance/lib/bulkDeleteSafety";
import {
  fetchWlApplicationsEnriched,
  fetchWlSelectionCount,
  wlBulkAction,
  wlFilterSnapshot,
} from "../features/clearance/lib/adminApi";
import { useWlAdminFilters } from "../features/clearance/hooks/useWlAdminFilters";
import { useBulkSelection } from "../features/clearance/hooks/useBulkSelection";
import { buildWlSelectionPayload } from "../features/clearance/lib/selection";
import type {
  WlApplicationEnriched,
  WlAuditFilter,
  WlBulkOperation,
} from "../features/clearance/lib/types";
import {
  copyToClipboard,
  fetchDistinctSources,
  fetchAuditEvents,
  fetchImportBatches,
  fetchWalletById,
  removeWallet,
  resetConfirmation,
  restoreWallet,
  updateWallet,
} from "../features/whitelist/lib/adminApi";
import type {
  AuditEvent,
  ImportBatch,
  WalletFilters,
  WalletStatus,
  WhitelistWallet,
} from "../features/whitelist/lib/types";
import {
  confirmationMethodLabel,
  formatDateTime,
  formatEventType,
  statusLabel,
} from "../features/whitelist/lib/format";
import { sanitizeNotes } from "../features/whitelist/lib/sanitize";
import { shortenWalletAddress } from "../features/whitelist/lib/wallet";
import AddWalletPanel from "../features/whitelist/components/AddWalletPanel";
import AdminWhitelistChecker from "../features/whitelist/components/AdminWhitelistChecker";

export default function AdminWalletsPage() {
  const { filters, setFilters } = useWlAdminFilters();
  const [rows, setRows] = useState<WlApplicationEnriched[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = filters.pageSize ?? 25;
  const [sources, setSources] = useState<string[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WhitelistWallet | null>(null);
  const [detailAudit, setDetailAudit] = useState<AuditEvent[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const pageIds = rows.map((row) => row.wallet.id);
  const filterSnapshot = wlFilterSnapshot(filters);
  const {
    count: selectedCount,
    toggle,
    selectCurrentPage,
    selectMatching,
    clear: clearSelection,
    rowSelected,
    allPageSelected,
    mode: selectionMode,
    selection,
  } = useBulkSelection(pageIds, total, filterSnapshot);

  const loadWallets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchWlApplicationsEnriched(filters);
      setRows(result.wallets);
      setTotal(result.total);
    } catch {
      setError("Failed to load wallets.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    document.title = "Whitelist — Blackwater Labs Admin";
  }, []);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  useEffect(() => {
    void fetchDistinctSources().then(setSources).catch(() => {});
    void fetchImportBatches().then(setBatches).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailAudit([]);
      return;
    }
    void fetchWalletById(selectedId).then(setDetail);
    void fetchAuditEvents(50, selectedId).then(setDetailAudit);
  }, [selectedId]);


  const resolveWlSelectionCount = async (): Promise<number> => {
    if (selectionMode === "all_matching") {
      return fetchWlSelectionCount(filters, [...selection.excludedIds]);
    }
    return selectedCount;
  };

  const runWlBulk = async (operation: WlBulkOperation, expectedCount?: number) => {
    if (selectedCount === 0) return;
    setBulkBusy(true);
    setError("");
    try {
      const effectiveCount = expectedCount ?? (await resolveWlSelectionCount());
      const payload = buildWlSelectionPayload(selection, effectiveCount);
      const result = await wlBulkAction(operation, filters, {
        selectionMode: payload.selectionMode,
        ids: payload.ids ?? undefined,
        excludeIds: payload.excludeIds,
        expectedCount: operation === "delete" ? effectiveCount : undefined,
        selectionLabel: `WL ${operation}`,
      });
      if (result.outcome === "count_changed") {
        setError(
          formatSelectionChangedMessage(
            result.expected ?? effectiveCount,
            result.current ?? effectiveCount,
          ),
        );
        return;
      }
      if (result.outcome !== "ok") {
        setError(`Bulk ${operation} failed.`);
        return;
      }
      clearSelection();
      void loadWallets();
    } catch {
      setError(`Bulk ${operation} failed.`);
    } finally {
      setBulkBusy(false);
    }
  };

  const openBulkDelete = async () => {
    try {
      setDeleteCount(await resolveWlSelectionCount());
      setShowBulkDelete(true);
    } catch {
      setError("Could not verify remove count.");
    }
  };

  const confirmBulkDelete = async () => {
    const serverCount = await resolveWlSelectionCount();
    if (serverCount !== deleteCount) {
      setError(formatSelectionChangedMessage(deleteCount, serverCount));
      setShowBulkDelete(false);
      return;
    }
    await runWlBulk("delete", serverCount);
    setShowBulkDelete(false);
  };

  const handleCopy = async (wallet: WhitelistWallet) => {
    const ok = await copyToClipboard(wallet.wallet_address);
    if (ok) {
      setCopiedId(wallet.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleStatusChange = async (status: WalletStatus) => {
    if (!detail) return;
    if (
      !window.confirm(`Change status to "${statusLabel(status)}"?`)
    ) {
      return;
    }
    const updated = await updateWallet(detail.id, { status }, "status_changed");
    setDetail(updated);
    void loadWallets();
  };

  const handleSaveNotes = async (notes: string) => {
    if (!detail) return;
    const updated = await updateWallet(detail.id, {
      internal_notes: sanitizeNotes(notes),
    });
    setDetail(updated);
  };

  const handleSpotsChange = async (spots: number) => {
    if (!detail || spots < 1) return;
    const updated = await updateWallet(detail.id, { wl_spots: spots });
    setDetail(updated);
    void loadWallets();
  };

  return (
    <div className="wl-admin-wallets">
      <div className="wl-admin__page-header">
        <div>
          <h1 className="wl-admin__page-title">Whitelist</h1>
          <p className="wl-admin__page-lead">{total} records matching filters</p>
          <p className="wl-admin__muted">
            <Link to="/admin/clearance">← Clearance Overview</Link>
          </p>
        </div>
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--primary"
          onClick={() => setShowAdd(true)}
        >
          Add Wallet
        </button>
      </div>

      <AdminWhitelistChecker onWalletsChanged={() => void loadWallets()} />

      <div className="wl-admin__filters">
        <input
          className="wl-admin__field-input"
          type="search"
          placeholder="Search wallet address…"
          value={filters.search ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))
          }
          aria-label="Search wallet address"
        />
        <select
          className="wl-admin__field-select"
          value={filters.status ?? "all"}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              status: e.target.value as WalletFilters["status"],
              page: 1,
            }))
          }
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="unconfirmed">Unconfirmed</option>
          <option value="confirmed">Confirmed</option>
          <option value="needs_review">Needs review</option>
          <option value="removed">Removed</option>
        </select>
        <select
          className="wl-admin__field-select"
          value={filters.activeState ?? "all"}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              activeState: e.target.value as WalletFilters["activeState"],
              page: 1,
            }))
          }
          aria-label="Filter by active state"
        >
          <option value="all">All active states</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive / removed</option>
        </select>
        <select
          className="wl-admin__field-select"
          value={filters.source ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              source: e.target.value || undefined,
              page: 1,
            }))
          }
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="wl-admin__field-select"
          value={filters.batchId ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              batchId: e.target.value || undefined,
              page: 1,
            }))
          }
          aria-label="Filter by import batch"
        >
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          className="wl-admin__field-select"
          value={filters.auditFilter ?? "all"}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              auditFilter: e.target.value as WlAuditFilter,
              page: 1,
            }))
          }
          aria-label="Audit filter"
        >
          <option value="all">All audit filters</option>
          <option value="duplicate_wallet">Duplicate WL wallet</option>
          <option value="also_in_fcfs">Also in FCFS</option>
          <option value="manual_review">Manual review</option>
          <option value="clean">Clean records</option>
        </select>
        <select
          className="wl-admin__field-select"
          value={`${filters.sortBy ?? "created_at"}-${filters.sortDir ?? "desc"}`}
          onChange={(e) => {
            const [sortBy, sortDir] = e.target.value.split("-") as [
              WalletFilters["sortBy"],
              WalletFilters["sortDir"],
            ];
            setFilters((f) => ({ ...f, sortBy, sortDir, page: 1 }));
          }}
          aria-label="Sort wallets"
        >
          <option value="created_at-desc">Newest first</option>
          <option value="created_at-asc">Oldest first</option>
          <option value="wallet_address_normalised-asc">Wallet A–Z</option>
          <option value="wallet_address_normalised-desc">Wallet Z–A</option>
          <option value="confirmed_at-desc">Recently confirmed</option>
        </select>
      </div>

      <FcfsPagination
        page={filters.page ?? 1}
        pageSize={pageSize}
        total={total}
        onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
      />

      <BulkSelectionBar
        entityLabel="wallets"
        pageCount={pageIds.length}
        matchingTotal={total}
        selectedCount={selectedCount}
        mode={selectionMode}
        onSelectPage={selectCurrentPage}
        onSelectAllMatching={selectMatching}
        onClear={clearSelection}
      >
        {selectedCount > 0 ? (
          <>
            <button
              type="button"
              className="wl-admin__btn wl-admin__btn--ghost"
              disabled={bulkBusy}
              onClick={() => void runWlBulk("flag_review")}
            >
              Flag for Review
            </button>
            <button
              type="button"
              className="wl-admin__btn wl-admin__btn--ghost"
              disabled={bulkBusy}
              onClick={() => void runWlBulk("clear_review")}
            >
              Clear Review Flag
            </button>
            <button
              type="button"
              className="wl-admin__btn wl-admin__btn--ghost"
              disabled={bulkBusy}
              onClick={() => void runWlBulk("activate")}
            >
              Activate
            </button>
            <button
              type="button"
              className="wl-admin__btn wl-admin__btn--ghost"
              disabled={bulkBusy}
              onClick={() => void runWlBulk("deactivate")}
            >
              Deactivate
            </button>
            <button
              type="button"
              className="wl-admin__btn wl-admin__btn--danger"
              disabled={bulkBusy}
              onClick={() => void openBulkDelete()}
            >
              Remove
            </button>
          </>
        ) : null}
      </BulkSelectionBar>

      {error && <p className="wl-admin__error">{error}</p>}

      <div className="wl-admin__table-wrap">
        <table className="wl-admin__table">
          <thead>
            <tr>
              <th scope="col">
                <input
                  type="checkbox"
                  aria-label="Select all on page"
                  checked={allPageSelected && rows.length > 0}
                  onChange={() => {
                    if (allPageSelected) clearSelection();
                    else selectCurrentPage();
                  }}
                />
              </th>
              <th scope="col">Wallet</th>
              <th scope="col">Audit</th>
              <th scope="col">Status</th>
              <th scope="col">Method</th>
              <th scope="col">Source</th>
              <th scope="col">Spots</th>
              <th scope="col">Added</th>
              <th scope="col">Confirmed</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10}>Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10}>No wallets found.</td>
              </tr>
            ) : (
              rows.map(({ wallet, audit_flags, also_in_fcfs }) => (
                <tr key={wallet.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={rowSelected(wallet.id)}
                      aria-label={`Select ${wallet.wallet_address}`}
                      onChange={() => toggle(wallet.id)}
                    />
                  </td>
                  <td>
                    <code>{shortenWalletAddress(wallet.wallet_address)}</code>
                  </td>
                  <td>
                    {also_in_fcfs ? (
                      <span className="wl-admin__badge">ALSO IN FCFS</span>
                    ) : null}
                    {audit_flags.map((flag) => (
                      <span
                        key={flag}
                        className="wl-admin__badge wl-admin__badge--warn"
                      >
                        {flag.replace(/_/g, " ")}
                      </span>
                    ))}
                  </td>
                  <td>{statusLabel(wallet.status)}</td>
                  <td>{confirmationMethodLabel(wallet.confirmation_method)}</td>
                  <td>{wallet.source ?? "—"}</td>
                  <td>{wallet.wl_spots}</td>
                  <td>{formatDateTime(wallet.created_at)}</td>
                  <td>{formatDateTime(wallet.confirmed_at)}</td>
                  <td className="wl-admin__table-actions">
                    <button
                      type="button"
                      className="wl-admin__btn wl-admin__btn--ghost"
                      onClick={() => setSelectedId(wallet.id)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="wl-admin__btn wl-admin__btn--ghost"
                      onClick={() => void handleCopy(wallet)}
                    >
                      {copiedId === wallet.id ? "Copied" : "Copy"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <FcfsPagination
        page={filters.page ?? 1}
        pageSize={pageSize}
        total={total}
        onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
      />

      {showAdd && (
        <AddWalletPanel
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            void loadWallets();
          }}
          onDuplicate={(wallet) => {
            setShowAdd(false);
            setSelectedId(wallet.id);
          }}
        />
      )}

      {detail && (
        <div
          className="wl-admin__modal-backdrop"
          role="presentation"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="wl-admin__modal"
            role="dialog"
            aria-labelledby="wallet-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="wallet-detail-title" className="wl-admin__modal-title">
              Wallet Details
            </h2>
            <dl className="wl-admin__detail-list">
              <dt>Address</dt>
              <dd>
                <code>{detail.wallet_address}</code>
              </dd>
              <dt>Status</dt>
              <dd>{statusLabel(detail.status)}</dd>
              <dt>Active</dt>
              <dd>{detail.is_active ? "Yes" : "No"}</dd>
              <dt>Spots</dt>
              <dd>
                <input
                  type="number"
                  min={1}
                  className="wl-admin__field-input wl-admin__field-input--small"
                  value={detail.wl_spots}
                  onChange={(e) =>
                    void handleSpotsChange(parseInt(e.target.value, 10))
                  }
                />
              </dd>
              <dt>Source</dt>
              <dd>{detail.source ?? "—"}</dd>
              <dt>Added</dt>
              <dd>{formatDateTime(detail.created_at)}</dd>
              <dt>Confirmed</dt>
              <dd>{formatDateTime(detail.confirmed_at)}</dd>
              <dt>Method</dt>
              <dd>{confirmationMethodLabel(detail.confirmation_method)}</dd>
              <dt>Notes</dt>
              <dd>
                <textarea
                  className="wl-admin__field-textarea"
                  rows={4}
                  defaultValue={detail.internal_notes ?? ""}
                  onBlur={(e) => void handleSaveNotes(e.target.value)}
                />
              </dd>
            </dl>

            {detailAudit.length > 0 && (
              <div className="wl-admin__section">
                <h3 className="wl-admin__section-title">Audit History</h3>
                <ul className="wl-admin__activity-list">
                  {detailAudit.map((event) => (
                    <li key={event.id} className="wl-admin__activity-item">
                      <span>{formatEventType(event.event_type)}</span>
                      <span className="wl-admin__activity-time">
                        {formatDateTime(event.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="wl-admin__modal-actions">
              <button
                type="button"
                className="wl-admin__btn wl-admin__btn--ghost"
                onClick={() => void handleStatusChange("needs_review")}
              >
                Mark Review
              </button>
              {detail.status !== "confirmed" && detail.is_active && (
                <button
                  type="button"
                  className="wl-admin__btn wl-admin__btn--ghost"
                  onClick={() => {
                    if (window.confirm("Confirm this wallet as admin?")) {
                      void updateWallet(
                        detail.id,
                        {
                          status: "confirmed",
                          confirmation_method: "admin",
                          confirmed_at: new Date().toISOString(),
                        },
                        "wallet_confirmed_admin",
                      ).then((w) => {
                        setDetail(w);
                        void loadWallets();
                      });
                    }
                  }}
                >
                  Confirm (Admin)
                </button>
              )}
              {detail.status === "removed" ? (
                <button
                  type="button"
                  className="wl-admin__btn wl-admin__btn--ghost"
                  onClick={() => {
                    if (window.confirm("Restore this wallet?")) {
                      void restoreWallet(detail.id).then((w) => {
                        setDetail(w);
                        void loadWallets();
                      });
                    }
                  }}
                >
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  className="wl-admin__btn wl-admin__btn--danger"
                  onClick={() => {
                    if (window.confirm("Remove/deactivate this wallet?")) {
                      void removeWallet(detail.id).then((w) => {
                        setDetail(w);
                        void loadWallets();
                      });
                    }
                  }}
                >
                  Remove
                </button>
              )}
              {detail.status === "confirmed" && (
                <button
                  type="button"
                  className="wl-admin__btn wl-admin__btn--ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Reset confirmation? This requires a deliberate admin action.",
                      )
                    ) {
                      void resetConfirmation(detail.id).then((w) => {
                        setDetail(w);
                        void loadWallets();
                      });
                    }
                  }}
                >
                  Reset Confirmation
                </button>
              )}
              <button
                type="button"
                className="wl-admin__btn wl-admin__btn--primary"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkDelete ? (
        <BulkDeleteConfirmModal
          title="Remove Whitelist Records"
          count={deleteCount}
          entityLabel="whitelist records"
          actionVerb="remove"
          confirmButtonLabel="Remove records"
          filterDescription={filters.auditFilter ?? "current selection"}
          onCancel={() => setShowBulkDelete(false)}
          onConfirm={confirmBulkDelete}
        />
      ) : null}
    </div>
  );
}
