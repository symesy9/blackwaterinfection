import { useState } from "react";
import { Link } from "react-router-dom";
import FcfsAuditFlags from "../features/fcfs/components/FcfsAuditFlags";
import { fcfsFiltersToSearchParams } from "../features/fcfs/hooks/useFcfsAdminFilters";
import { fetchFcfsWalletAudit } from "../features/fcfs/lib/adminApi";
import { fcfsStatusLabel, formatDateTime } from "../features/fcfs/lib/format";
import type { FcfsWalletAuditResult } from "../features/fcfs/lib/types";
import { validateWalletInput } from "../features/whitelist/lib/wallet";

export default function AdminFcfsWalletAuditPage() {
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FcfsWalletAuditResult | null>(null);

  const runAudit = async () => {
    const validation = validateWalletInput(wallet);
    if (!validation.valid) {
      setError(validation.error ?? "Enter a valid Ethereum wallet address.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const audit = await fetchFcfsWalletAudit(validation.normalised ?? wallet);
      if (audit.outcome === "invalid_wallet") {
        setError("Enter a valid Ethereum wallet address.");
        setResult(null);
        return;
      }
      setResult(audit);
    } catch {
      setError("Wallet audit failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wl-admin-wallets">
      <div className="wl-admin__page-header">
        <div>
          <h1 className="wl-admin__page-title">Wallet Audit</h1>
          <p className="wl-admin__page-lead">
            Internal database cross-check for FCFS and whitelist records.
          </p>
          <p className="wl-admin__muted">
            <Link to="/admin/fcfs">← Back to FCFS Applications</Link>
          </p>
        </div>
      </div>

      <div className="wl-admin__filters">
        <input
          className="wl-admin__field-input"
          type="text"
          placeholder="0x… full wallet address"
          value={wallet}
          spellCheck={false}
          onChange={(event) => setWallet(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void runAudit();
            }
          }}
        />
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--primary"
          disabled={loading}
          onClick={() => void runAudit()}
        >
          {loading ? "Searching…" : "Run Wallet Audit"}
        </button>
      </div>

      {error ? (
        <p className="wl-admin__error" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="wl-admin__card">
          <h2 className="wl-admin__card-title">Results</h2>
          <p>
            Wallet: <code>{result.wallet_address_normalised}</code>
          </p>
          <p>
            Whitelist record:{" "}
            <strong>{result.on_whitelist ? "YES" : "NO"}</strong>
          </p>

          {result.whitelist_record ? (
            <dl className="wl-admin__detail-grid">
              <div>
                <dt>WL status</dt>
                <dd>{String(result.whitelist_record.status ?? "—")}</dd>
              </div>
              <div>
                <dt>WL spots</dt>
                <dd>{String(result.whitelist_record.wl_spots ?? "—")}</dd>
              </div>
              <div>
                <dt>WL active</dt>
                <dd>{result.whitelist_record.is_active ? "Yes" : "No"}</dd>
              </div>
            </dl>
          ) : null}

          <h3 className="wl-admin__field-label">FCFS records</h3>
          {(result.fcfs_applications ?? []).length === 0 ? (
            <p className="wl-admin__muted">No FCFS application for this wallet.</p>
          ) : (
            (result.fcfs_applications ?? []).map((entry) => {
              const app = entry.application;
              const params = fcfsFiltersToSearchParams({
                selectedId: app.id,
                page: 1,
              });
              return (
                <div key={app.id} className="wl-admin__audit-card">
                  <p>
                    <Link to={`/admin/fcfs?${params.toString()}`}>
                      Open in FCFS list
                    </Link>
                  </p>
                  <dl className="wl-admin__detail-grid">
                    <div>
                      <dt>FCFS status</dt>
                      <dd>{fcfsStatusLabel(app.status)}</dd>
                    </div>
                    <div>
                      <dt>X handle</dt>
                      <dd>{app.x_handle}</dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>{formatDateTime(app.submitted_at)}</dd>
                    </div>
                    <div>
                      <dt>Manual review</dt>
                      <dd>{app.manual_review_flag ? "Yes" : "No"}</dd>
                    </div>
                  </dl>
                  <FcfsAuditFlags flags={entry.audit_flags ?? []} />
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
