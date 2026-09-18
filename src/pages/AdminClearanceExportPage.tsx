import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { parseFcfsFiltersFromSearchParams } from "../features/fcfs/hooks/useFcfsAdminFilters";
import {
  fcfsFiltersToRpcParams,
  fetchClearanceExportV2,
} from "../features/clearance/lib/adminApi";
import {
  combinedExportPreview,
  combinedExportToCsv,
  dedupeCombinedExportRows,
  downloadCsv,
} from "../features/clearance/lib/export";
import type { CombinedExportRow } from "../features/clearance/lib/types";

const EXPORT_TYPES = [
  { value: "wl_mint_ready", label: "Whitelist — mint ready" },
  { value: "wl_admin_full", label: "Whitelist — admin full" },
  { value: "fcfs_approved_mint_ready", label: "FCFS approved — mint ready" },
  { value: "fcfs_admin_all", label: "FCFS — all admin records" },
  { value: "combined_mint_ready", label: "Combined WL + FCFS — mint ready" },
  { value: "flagged_fcfs", label: "Flagged for review (FCFS)" },
  { value: "current_filter_fcfs", label: "Current FCFS filter" },
  { value: "custom", label: "Custom export" },
];

export default function AdminClearanceExportPage() {
  const [searchParams] = useSearchParams();
  const fcfsFilters = parseFcfsFiltersFromSearchParams(searchParams);
  const [exportType, setExportType] = useState("combined_mint_ready");
  const [customDataset, setCustomDataset] = useState("combined");
  const [preview, setPreview] = useState<ReturnType<typeof combinedExportPreview> | null>(
    null,
  );
  const [integrityError, setIntegrityError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.title = "Clearance Export — Blackwater Labs Admin";
  }, []);

  const buildConfig = () => {
    if (exportType === "current_filter_fcfs") {
      return {
        export_type: "current_filter_fcfs",
        ...fcfsFiltersToRpcParams(fcfsFilters),
      };
    }
    if (exportType === "custom") {
      return {
        export_type:
          customDataset === "combined"
            ? "combined_mint_ready"
            : customDataset === "wl"
              ? "wl_mint_ready"
              : "fcfs_admin_all",
      };
    }
    return { export_type: exportType };
  };

  const runPreview = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    setPreview(null);
    setIntegrityError("");
    try {
      const result = await fetchClearanceExportV2(buildConfig());
      if (result.outcome === "integrity_error") {
        setIntegrityError("EXPORT INTEGRITY ERROR — duplicate wallet detected.");
        return;
      }
      if (result.outcome !== "ok") {
        setError("Export preview failed.");
        return;
      }
      const rows = (result.rows ?? []) as CombinedExportRow[];
      const mintReady = exportType.includes("mint") || exportType === "combined_mint_ready";
      const deduped = mintReady ? dedupeCombinedExportRows(rows) : rows;
      if (mintReady && deduped.length !== new Set(deduped.map((r) => r.wallet_address_normalised)).size) {
        setIntegrityError("EXPORT INTEGRITY ERROR — duplicate wallet detected.");
        return;
      }
      setPreview(combinedExportPreview(deduped));
    } catch {
      setError("Export preview failed.");
    } finally {
      setLoading(false);
    }
  };

  const runDownload = () => {
    if (!preview) return;
    const csv = combinedExportToCsv(preview.rows);
    downloadCsv(`blackwater-clearance-${exportType}.csv`, csv);
    setMessage(`Downloaded ${preview.uniqueWallets} unique wallets.`);
  };

  return (
    <div className="wl-admin-export">
      <h1 className="wl-admin__page-title">Clearance Export</h1>
      <p className="wl-admin__page-lead">
        Server-side exports with preview. Mint-ready exports deduplicate to one row per wallet.
        No <code>effective_mint_allowance</code> — separate WL/FCFS allowances only.
      </p>
      <p className="wl-admin__muted">
        <Link to="/admin/clearance">← Clearance Overview</Link>
      </p>

      <label className="wl-admin__field-label" htmlFor="export-type">
        Export type
      </label>
      <select
        id="export-type"
        className="wl-admin__field-select"
        value={exportType}
        onChange={(event) => setExportType(event.target.value)}
      >
        {EXPORT_TYPES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      {exportType === "custom" ? (
        <select
          className="wl-admin__field-select"
          value={customDataset}
          onChange={(event) => setCustomDataset(event.target.value)}
        >
          <option value="wl">Whitelist</option>
          <option value="fcfs">FCFS</option>
          <option value="combined">Combined</option>
        </select>
      ) : null}

      {exportType === "current_filter_fcfs" ? (
        <p className="wl-admin__muted">
          Uses active FCFS filter from URL (open FCFS list with filters first, or pass query params).
        </p>
      ) : null}

      <div className="wl-admin__header-actions">
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--primary"
          disabled={loading}
          onClick={() => void runPreview()}
        >
          {loading ? "Loading preview…" : "Preview export"}
        </button>
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--ghost"
          disabled={!preview}
          onClick={runDownload}
        >
          Download CSV
        </button>
      </div>

      {integrityError ? (
        <p className="wl-admin__error" role="alert">
          {integrityError}
        </p>
      ) : null}
      {error ? (
        <p className="wl-admin__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="wl-admin__message">{message}</p> : null}

      {preview ? (
        <div className="wl-admin__card">
          <h2 className="wl-admin__card-title">Export preview</h2>
          <dl className="wl-admin__detail-grid">
            <div>
              <dt>Unique wallets</dt>
              <dd>{preview.uniqueWallets.toLocaleString()}</dd>
            </div>
            <div>
              <dt>WL only</dt>
              <dd>{preview.wlOnly.toLocaleString()}</dd>
            </div>
            <div>
              <dt>FCFS only</dt>
              <dd>{preview.fcfsOnly.toLocaleString()}</dd>
            </div>
            <div>
              <dt>WL + FCFS crossover</dt>
              <dd>{preview.crossover.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
