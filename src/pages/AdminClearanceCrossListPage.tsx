import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import FcfsPagination from "../features/fcfs/components/FcfsPagination";
import {
  fetchClearanceOverview,
  fetchCrossListFcfsHandles,
  fetchCrossListWallets,
} from "../features/clearance/lib/adminApi";
import type { ClearanceOverview, CrossListRow, CrossListView } from "../features/clearance/lib/types";
import { fcfsFiltersToSearchParams } from "../features/fcfs/hooks/useFcfsAdminFilters";
import { shortenWalletAddress } from "../features/whitelist/lib/wallet";

const WALLET_VIEWS: { value: CrossListView; label: string }[] = [
  { value: "crossover", label: "Wallet crossover" },
  { value: "wl_only", label: "WL only" },
  { value: "fcfs_only", label: "FCFS only" },
  { value: "duplicates", label: "Within-dataset duplicates" },
  { value: "clean", label: "Clean" },
];

type Tab = "wallet" | "x_handle" | "duplicates" | "clean";

export default function AdminClearanceCrossListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) ?? "wallet";
  const view = (searchParams.get("view") as CrossListView) ?? "crossover";
  const [overview, setOverview] = useState<ClearanceOverview | null>(null);
  const [rows, setRows] = useState<CrossListRow[]>([]);
  const [handleRows, setHandleRows] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await fetchClearanceOverview());
      if (tab === "x_handle") {
        const data = await fetchCrossListFcfsHandles("duplicates", page, pageSize);
        setHandleRows(data.rows);
        setTotal(data.total);
        setRows([]);
      } else {
        const listView: CrossListView =
          tab === "duplicates" ? "duplicates" : tab === "clean" ? "clean" : view;
        const listData = await fetchCrossListWallets(listView, page, pageSize);
        setRows(listData.rows);
        setTotal(listData.total);
        setHandleRows([]);
      }
    } catch {
      setError("Failed to load cross-list audit.");
    } finally {
      setLoading(false);
    }
  }, [page, tab, view]);

  useEffect(() => {
    document.title = "Cross-List Audit — Blackwater Labs Admin";
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    if (next === "wallet") params.set("view", "crossover");
    setSearchParams(params);
    setPage(1);
  };

  return (
    <div className="wl-admin-wallets">
      <div className="wl-admin__page-header">
        <div>
          <h1 className="wl-admin__page-title">Cross-List Audit</h1>
          <p className="wl-admin__page-lead">
            WL ↔ FCFS crossover is expected. Within-dataset duplicates are flagged separately.
          </p>
          <p className="wl-admin__muted">
            <Link to="/admin/clearance">← Clearance Overview</Link>
          </p>
        </div>
      </div>

      {overview ? (
        <div className="wl-admin__cards wl-admin__cards--audit">
          <div className="wl-admin__card">
            <span className="wl-admin__card-label">Crossover wallets</span>
            <span className="wl-admin__card-value">
              {overview.combined.wallet_crossover.toLocaleString()}
            </span>
          </div>
          <div className="wl-admin__card">
            <span className="wl-admin__card-label">Identity conflicts</span>
            <span className="wl-admin__card-value">
              {overview.security.identity_conflicts.toLocaleString()}
            </span>
          </div>
        </div>
      ) : null}

      <div className="wl-admin__filters">
        {(["wallet", "x_handle", "duplicates", "clean"] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`wl-admin__btn wl-admin__btn--ghost${tab === item ? " is-active" : ""}`}
            onClick={() => setTab(item)}
          >
            {item === "wallet"
              ? "Wallet crossover"
              : item === "x_handle"
                ? "X handle crossover"
                : item === "duplicates"
                  ? "Duplicates"
                  : "Clean"}
          </button>
        ))}
      </div>

      {tab === "wallet" ? (
        <select
          className="wl-admin__field-input"
          value={view}
          onChange={(event) => {
            const params = new URLSearchParams(searchParams);
            params.set("view", event.target.value);
            setSearchParams(params);
            setPage(1);
          }}
        >
          {WALLET_VIEWS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      ) : null}

      {tab === "x_handle" ? (
        <div className="wl-admin__card">
          <p>
            Whitelist records currently contain wallet addresses only. Cross-list X handle
            comparison is unavailable.
          </p>
          <p className="wl-admin__muted">
            FCFS duplicate X handle groups are shown below for audit purposes.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="wl-admin__error" role="alert">
          {error}
        </p>
      ) : null}

      <FcfsPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      {loading ? (
        <p className="wl-admin__loading">Loading cross-list records…</p>
      ) : tab === "x_handle" ? (
        <div className="wl-admin__table-wrap">
          <table className="wl-admin__table">
            <thead>
              <tr>
                <th>X handle</th>
                <th>Records</th>
                <th>Wallets</th>
                <th>Associated wallets</th>
              </tr>
            </thead>
            <tbody>
              {handleRows.length === 0 ? (
                <tr>
                  <td colSpan={4}>No duplicate X handle groups.</td>
                </tr>
              ) : (
                handleRows.map((row) => (
                  <tr key={String(row.x_handle_normalised)}>
                    <td>@{String(row.x_handle_normalised)}</td>
                    <td>{String(row.record_count)}</td>
                    <td>{String(row.wallet_count)}</td>
                    <td>{String(row.wallets)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="wl-admin__table-wrap">
          <table className="wl-admin__table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th>WL</th>
                <th>FCFS</th>
                <th>Entitlement</th>
                <th>Flags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>No records match this view.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.wallet_address_normalised}>
                    <td>
                      <code>{shortenWalletAddress(row.wallet_address_normalised)}</code>
                    </td>
                    <td>{row.wl_records > 0 ? "YES" : "NO"}</td>
                    <td>{row.fcfs_records > 0 ? row.fcfs_status ?? "YES" : "NO"}</td>
                    <td>{row.entitlement}</td>
                    <td>
                      {row.is_crossover ? (
                        <span className="wl-admin__badge">VALID CROSSOVER</span>
                      ) : null}
                    </td>
                    <td>
                      <Link
                        to={`/admin/clearance/fcfs?${fcfsFiltersToSearchParams({
                          search: row.wallet_address_normalised,
                          page: 1,
                        }).toString()}`}
                      >
                        View FCFS
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <FcfsPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </div>
  );
}
