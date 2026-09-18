import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchClearanceOverview } from "../features/clearance/lib/adminApi";
import type { ClearanceOverview } from "../features/clearance/lib/types";

function OverviewLink({
  to,
  label,
  value,
  sub,
}: {
  to: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Link to={to} className="wl-admin__card wl-admin__card--link">
      <span className="wl-admin__card-label">{label}</span>
      <span className="wl-admin__card-value">{value}</span>
      {sub ? <span className="wl-admin__card-sub">{sub}</span> : null}
    </Link>
  );
}

export default function AdminClearanceOverviewPage() {
  const [overview, setOverview] = useState<ClearanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await fetchClearanceOverview());
    } catch {
      setError("Failed to load clearance overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Clearance Overview — Blackwater Labs Admin";
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="wl-admin-wallets">
      <div className="wl-admin__page-header">
        <div>
          <h1 className="wl-admin__page-title">Clearance Overview</h1>
          <p className="wl-admin__page-lead">
            Unified view of whitelist, FCFS, and cross-list clearance status.
          </p>
        </div>
      </div>

      {error ? (
        <p className="wl-admin__error" role="alert">
          {error}
        </p>
      ) : null}

      {loading || !overview ? (
        <p className="wl-admin__loading">Loading overview…</p>
      ) : (
        <>
          <div className="wl-admin__cards wl-admin__cards--audit">
            <OverviewLink
              to="/admin/clearance/whitelist"
              label="Whitelist active"
              value={overview.whitelist.active.toLocaleString()}
              sub={`${overview.whitelist.total.toLocaleString()} total`}
            />
            <OverviewLink
              to="/admin/clearance/fcfs"
              label="FCFS total"
              value={overview.fcfs.total.toLocaleString()}
              sub={`${overview.fcfs.pending} pending`}
            />
            <OverviewLink
              to="/admin/clearance/fcfs?audit=flagged"
              label="FCFS flagged"
              value={overview.fcfs.flagged.toLocaleString()}
            />
            <OverviewLink
              to="/admin/clearance/cross-list?view=crossover"
              label="WL + FCFS crossover"
              value={overview.combined.wallet_crossover.toLocaleString()}
            />
          </div>

          <div className="wl-admin__cards wl-admin__cards--audit">
            <OverviewLink
              to="/admin/clearance/burst-audit"
              label="Duplicate X handle groups"
              value={overview.security.duplicate_fcfs_handle_groups.toLocaleString()}
            />
            <OverviewLink
              to="/admin/clearance/cross-list?view=duplicates"
              label="Identity conflicts"
              value={overview.security.identity_conflicts.toLocaleString()}
            />
            <OverviewLink
              to="/admin/clearance/cross-list?view=wl_only"
              label="WL only wallets"
              value={overview.combined.wl_only.toLocaleString()}
            />
            <OverviewLink
              to="/admin/clearance/cross-list?view=fcfs_only"
              label="FCFS only wallets"
              value={overview.combined.fcfs_only.toLocaleString()}
            />
          </div>

          <div className="wl-admin__header-actions">
            <Link className="wl-admin__btn wl-admin__btn--primary" to="/admin/clearance/whitelist">
              Whitelist
            </Link>
            <Link className="wl-admin__btn wl-admin__btn--ghost" to="/admin/clearance/fcfs">
              FCFS
            </Link>
            <Link className="wl-admin__btn wl-admin__btn--ghost" to="/admin/import">
              Import
            </Link>
            <Link className="wl-admin__btn wl-admin__btn--ghost" to="/admin/clearance/export">
              Export
            </Link>
            <Link className="wl-admin__btn wl-admin__btn--ghost" to="/admin/clearance/burst-audit">
              Burst Audit
            </Link>
            <Link className="wl-admin__btn wl-admin__btn--ghost" to="/admin/clearance/wallet-audit">
              Wallet Audit
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
