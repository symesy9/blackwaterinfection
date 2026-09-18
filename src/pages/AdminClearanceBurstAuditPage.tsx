import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BulkDeleteConfirmModal from "../features/clearance/components/BulkDeleteConfirmModal";
import {
  fcfsBulkAction,
  fetchClearanceBurstWindows,
  fetchFcfsBurstSelectionCount,
} from "../features/clearance/lib/adminApi";
import { formatSelectionChangedMessage } from "../features/clearance/lib/bulkDeleteSafety";
import type { ClearanceBurstWindow } from "../features/clearance/lib/types";
import { fcfsFiltersToSearchParams } from "../features/fcfs/hooks/useFcfsAdminFilters";
import { formatDateTime } from "../features/fcfs/lib/format";

const WINDOW_OPTIONS = [
  { minutes: 1440, label: "Day" },
  { minutes: 60, label: "Hour" },
  { minutes: 15, label: "15 minutes" },
  { minutes: 5, label: "5 minutes" },
  { minutes: 2, label: "2 minutes" },
];

export default function AdminClearanceBurstAuditPage() {
  const navigate = useNavigate();
  const [windowMinutes, setWindowMinutes] = useState(5);
  const [bursts, setBursts] = useState<ClearanceBurstWindow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uniqueSelectedCount, setUniqueSelectedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBursts(await fetchClearanceBurstWindows(windowMinutes, 5));
      setSelected(new Set());
      setUniqueSelectedCount(0);
    } catch {
      setError("Failed to load burst windows.");
    } finally {
      setLoading(false);
    }
  }, [windowMinutes]);

  useEffect(() => {
    document.title = "Burst Audit — Blackwater Labs Admin";
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleBurst = (key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedBursts = bursts.filter((burst) =>
    selected.has(`${burst.bucket_start}|${burst.bucket_end}`),
  );

  const selectedBurstWindows = useMemo(
    () =>
      selectedBursts.map((burst) => ({
        start: burst.bucket_start,
        end: burst.bucket_end,
      })),
    [selectedBursts],
  );

  const burstSelectionKey = useMemo(
    () =>
      selectedBurstWindows
        .map((window) => `${window.start}|${window.end}`)
        .join(";"),
    [selectedBurstWindows],
  );

  useEffect(() => {
    if (!burstSelectionKey) {
      setUniqueSelectedCount(0);
      return;
    }
    void fetchFcfsBurstSelectionCount(selectedBurstWindows)
      .then(setUniqueSelectedCount)
      .catch(() => setUniqueSelectedCount(0));
  }, [burstSelectionKey, selectedBurstWindows]);

  const viewCombined = () => {
    const params = fcfsFiltersToSearchParams({
      burstWindows: selectedBurstWindows,
      page: 1,
    });
    navigate(`/admin/clearance/fcfs?${params.toString()}`);
  };

  const resolveBurstCount = async (): Promise<number> => {
    if (selectedBurstWindows.length === 0) return 0;
    return fetchFcfsBurstSelectionCount(selectedBurstWindows);
  };

  const runBurstBulk = async (
    operation: "flag_review" | "reject" | "delete",
    expectedCount?: number,
  ) => {
    if (selectedBurstWindows.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const currentCount = await resolveBurstCount();
      const result = await fcfsBulkAction(
        operation,
        { burstWindows: selectedBurstWindows },
        {
          selectionMode: "filter",
          expectedCount: operation === "delete" ? (expectedCount ?? currentCount) : undefined,
          selectionLabel: `${selectedBurstWindows.length} burst windows`,
        },
      );
      if (result.outcome === "count_changed") {
        setError(
          formatSelectionChangedMessage(
            result.expected ?? expectedCount ?? currentCount,
            result.current ?? currentCount,
          ),
        );
        return;
      }
      if (result.outcome !== "ok") {
        setError(`Bulk ${operation} failed.`);
        return;
      }
      setShowDelete(false);
      void load();
    } catch {
      setError(`Bulk ${operation} failed.`);
    } finally {
      setBusy(false);
    }
  };

  const openBulkDelete = async () => {
    try {
      setDeleteCount(await resolveBurstCount());
      setShowDelete(true);
    } catch {
      setError("Could not verify delete count.");
    }
  };

  const confirmBulkDelete = async () => {
    const serverCount = await resolveBurstCount();
    if (serverCount !== deleteCount) {
      setError(formatSelectionChangedMessage(deleteCount, serverCount));
      setShowDelete(false);
      return;
    }
    await runBurstBulk("delete", serverCount);
  };

  return (
    <div className="wl-admin-wallets">
      <div className="wl-admin__page-header">
        <div>
          <h1 className="wl-admin__page-title">Burst Audit</h1>
          <p className="wl-admin__page-lead">
            Burst membership is not proof of bot activity. Review before bulk actions.
          </p>
          <p className="wl-admin__muted">
            <Link to="/admin/clearance">← Clearance Overview</Link>
          </p>
        </div>
      </div>

      <div className="wl-admin__filters">
        <select
          className="wl-admin__field-input"
          value={windowMinutes}
          onChange={(event) => setWindowMinutes(Number.parseInt(event.target.value, 10))}
        >
          {WINDOW_OPTIONS.map((option) => (
            <option key={option.minutes} value={option.minutes}>
              Group by {option.label}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 ? (
        <div className="wl-admin__bulk-bar">
          <span>
            Selected: {selected.size} burst{selected.size === 1 ? "" : "s"} ·{" "}
            {uniqueSelectedCount.toLocaleString()} unique applications
          </span>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={viewCombined}
          >
            View combined
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            disabled={busy}
            onClick={() => void runBurstBulk("flag_review")}
          >
            Flag for review
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            disabled={busy}
            onClick={() => void runBurstBulk("reject")}
          >
            Reject
          </button>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--danger"
            disabled={busy}
            onClick={() => void openBulkDelete()}
          >
            Delete
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="wl-admin__error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="wl-admin__loading">Loading burst windows…</p>
      ) : (
        <div className="wl-admin__table-wrap">
          <table className="wl-admin__table">
            <thead>
              <tr>
                <th />
                <th>Time window</th>
                <th>Submissions</th>
                <th>Unique wallets</th>
                <th>Unique handles</th>
                <th>Flagged</th>
                <th>Pending</th>
                <th>Approved</th>
                <th>Rejected</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bursts.length === 0 ? (
                <tr>
                  <td colSpan={10}>No suspicious bursts for this window size.</td>
                </tr>
              ) : (
                bursts.map((burst) => {
                  const key = `${burst.bucket_start}|${burst.bucket_end}`;
                  const viewLink = `/admin/clearance/fcfs?${fcfsFiltersToSearchParams({
                    burstStart: burst.bucket_start,
                    burstEnd: burst.bucket_end,
                    page: 1,
                  }).toString()}`;
                  return (
                    <tr key={key}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(key)}
                          aria-label={`Select burst ${formatDateTime(burst.bucket_start)}`}
                          onChange={() => toggleBurst(key)}
                        />
                      </td>
                      <td>
                        {formatDateTime(burst.bucket_start)} —{" "}
                        {formatDateTime(burst.bucket_end)}
                      </td>
                      <td>{burst.application_count}</td>
                      <td>{burst.unique_wallets}</td>
                      <td>{burst.unique_handles}</td>
                      <td>{burst.flagged_count}</td>
                      <td>{burst.pending_count ?? 0}</td>
                      <td>{burst.approved_count ?? 0}</td>
                      <td>{burst.rejected_count ?? 0}</td>
                      <td>
                        <Link to={viewLink}>View applications</Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showDelete ? (
        <BulkDeleteConfirmModal
          title="Delete FCFS applications"
          count={deleteCount}
          filterDescription={`${selected.size} selected burst windows (unique applications)`}
          onCancel={() => setShowDelete(false)}
          onConfirm={confirmBulkDelete}
        />
      ) : null}
    </div>
  );
}
