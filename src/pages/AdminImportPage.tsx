import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  commitClearanceImport,
  previewClearanceImport,
} from "../features/clearance/lib/adminApi";
import type { ImportPreviewResult } from "../features/clearance/lib/types";

type ImportTab = "all" | "ready" | "invalid" | "duplicates" | "crossovers" | "conflicts";

function parseCsv(text: string, dataset: "whitelist" | "fcfs") {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split(",").map((part) => part.trim());
      if (dataset === "whitelist") {
        return { line: index + 1, wallet: parts[0] ?? "", notes: parts[1] ?? null };
      }
      return {
        line: index + 1,
        wallet: parts[0] ?? "",
        x_handle: parts[1] ?? "",
        status: parts[2] ?? "pending",
        notes: parts[3] ?? null,
      };
    });
}

export default function AdminImportPage() {
  const [dataset, setDataset] = useState<"whitelist" | "fcfs">("whitelist");
  const [text, setText] = useState("");
  const [batchName, setBatchName] = useState("Admin import");
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [tab, setTab] = useState<ImportTab>("all");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.title = "Import — Blackwater Labs Admin";
  }, []);

  const filteredRows = useMemo(() => {
    if (!preview?.rows) return [];
    const categoryMap: Record<ImportTab, string | null> = {
      all: null,
      ready: "ready",
      invalid: "invalid_wallet",
      duplicates: "duplicate_in_file",
      crossovers: "crossover",
      conflicts: "handle_conflict",
    };
    const category = categoryMap[tab];
    if (!category) return preview.rows;
    if (tab === "invalid") {
      return preview.rows.filter(
        (row) =>
          row.category === "invalid_wallet" || row.category === "invalid_handle",
      );
    }
    return preview.rows.filter((row) => row.category === category);
  }, [preview, tab]);

  const runPreview = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    setPreview(null);
    try {
      const rows = parseCsv(text, dataset);
      if (rows.length === 0) {
        setError("No rows detected.");
        return;
      }
      setPreview(await previewClearanceImport(dataset, rows));
    } catch {
      setError("Import preview failed.");
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    const ready = preview.summary.ready;
    const required = `CONFIRM IMPORT ${ready}`;
    if (confirmPhrase !== required) {
      setError(`Type "${required}" to continue.`);
      return;
    }
    setImporting(true);
    setError("");
    try {
      const result = await commitClearanceImport(
        dataset,
        preview.rows.filter((row) => row.category === "ready"),
        ready,
        batchName,
      );
      if (result.outcome !== "ok") {
        setError("Import failed or count mismatch.");
        return;
      }
      setMessage(`Imported ${result.imported ?? 0} records.`);
      setPreview(null);
      setConfirmPhrase("");
      setText("");
    } catch {
      setError("Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setText(await file.text());
  };

  return (
    <div className="wl-admin-export">
      <h1 className="wl-admin__page-title">Clearance Import</h1>
      <p className="wl-admin__page-lead">
        Upload CSV, preview server-side, then confirm import. Never silently overwrites existing
        records.
      </p>
      <p className="wl-admin__muted">
        <Link to="/admin/clearance">← Clearance Overview</Link>
      </p>

      <label className="wl-admin__field-label">Import type</label>
      <select
        className="wl-admin__field-select"
        value={dataset}
        onChange={(event) =>
          setDataset(event.target.value as "whitelist" | "fcfs")
        }
      >
        <option value="whitelist">Whitelist</option>
        <option value="fcfs">FCFS</option>
      </select>

      <input type="file" accept=".csv,text/csv" onChange={(event) => void onFile(event)} />

      <textarea
        className="wl-admin__field-textarea"
        rows={10}
        value={text}
        placeholder={
          dataset === "whitelist"
            ? "wallet,notes\n0x...,optional notes"
            : "wallet,x_handle,status,notes"
        }
        onChange={(event) => setText(event.target.value)}
      />

      <input
        className="wl-admin__field-input"
        value={batchName}
        onChange={(event) => setBatchName(event.target.value)}
        placeholder="Batch name"
      />

      <button
        type="button"
        className="wl-admin__btn wl-admin__btn--primary"
        disabled={loading}
        onClick={() => void runPreview()}
      >
        {loading ? "Previewing…" : "Preview import"}
      </button>

      {preview ? (
        <>
          <div className="wl-admin__card">
            <h2 className="wl-admin__card-title">Import preview</h2>
            <dl className="wl-admin__detail-grid">
              <div><dt>Total rows</dt><dd>{preview.summary.total}</dd></div>
              <div><dt>Ready to import</dt><dd>{preview.summary.ready}</dd></div>
              <div><dt>Invalid wallet</dt><dd>{preview.summary.invalid_wallet}</dd></div>
              <div><dt>Invalid X handle</dt><dd>{preview.summary.invalid_handle}</dd></div>
              <div><dt>Duplicate in file</dt><dd>{preview.summary.duplicate_in_file}</dd></div>
              <div><dt>Already in WL</dt><dd>{preview.summary.already_in_wl}</dd></div>
              <div><dt>Already in FCFS</dt><dd>{preview.summary.already_in_fcfs}</dd></div>
              <div><dt>Crossover</dt><dd>{preview.summary.crossover}</dd></div>
              <div><dt>Handle conflicts</dt><dd>{preview.summary.handle_conflict}</dd></div>
            </dl>
          </div>

          <div className="wl-admin__filters">
            {(["all", "ready", "invalid", "duplicates", "crossovers", "conflicts"] as ImportTab[]).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  className={`wl-admin__btn wl-admin__btn--ghost${tab === item ? " is-active" : ""}`}
                  onClick={() => setTab(item)}
                >
                  {item}
                </button>
              ),
            )}
          </div>

          <div className="wl-admin__table-wrap">
            <table className="wl-admin__table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Wallet</th>
                  {dataset === "fcfs" ? <th>X handle</th> : null}
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.slice(0, 100).map((row, index) => (
                  <tr key={`${row.line}-${index}`}>
                    <td>{String(row.line ?? index + 1)}</td>
                    <td>{String(row.wallet ?? "")}</td>
                    {dataset === "fcfs" ? <td>{String(row.x_handle ?? "")}</td> : null}
                    <td>{String(row.category ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <input
            className="wl-admin__field-input"
            placeholder={`CONFIRM IMPORT ${preview.summary.ready}`}
            value={confirmPhrase}
            onChange={(event) => setConfirmPhrase(event.target.value)}
          />
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--primary"
            disabled={importing || preview.summary.ready === 0}
            onClick={() => void runImport()}
          >
            {importing ? "Importing…" : "Confirm import"}
          </button>
        </>
      ) : null}

      {error ? <p className="wl-admin__error">{error}</p> : null}
      {message ? <p className="wl-admin__message">{message}</p> : null}
    </div>
  );
}
