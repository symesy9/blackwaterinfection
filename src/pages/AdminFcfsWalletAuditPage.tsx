import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import FcfsAuditFlags from "../features/fcfs/components/FcfsAuditFlags";
import { fcfsFiltersToSearchParams } from "../features/fcfs/hooks/useFcfsAdminFilters";
import { fetchFcfsWalletAudit } from "../features/fcfs/lib/adminApi";
import { fetchHandleLookup } from "../features/clearance/lib/adminApi";
import { fcfsStatusLabel, formatDateTime } from "../features/fcfs/lib/format";
import type {
  FcfsApplicationStatus,
  FcfsWalletAuditResult,
} from "../features/fcfs/lib/types";
import type { HandleLookupResult } from "../features/clearance/lib/types";
import { validateWalletInput } from "../features/whitelist/lib/wallet";

export default function AdminFcfsWalletAuditPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"wallet" | "handle">("wallet");
  const [wallet, setWallet] = useState(searchParams.get("wallet") ?? "");
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FcfsWalletAuditResult | null>(null);
  const [handleResult, setHandleResult] = useState<HandleLookupResult | null>(
    null,
  );

  useEffect(() => {
    document.title = "Wallet Audit — Blackwater Labs Admin";
  }, []);

  useEffect(() => {
    const param = searchParams.get("wallet");
    if (param) {
      setWallet(param);
      setMode("wallet");
    }
  }, [searchParams]);

  const runWalletAudit = async () => {
    const validation = validateWalletInput(wallet);
    if (!validation.valid) {
      setError(validation.error ?? "Enter a valid Ethereum wallet address.");
      setResult(null);
      setHandleResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setHandleResult(null);
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

  const runHandleAudit = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const audit = await fetchHandleLookup(handle);
      if (audit.outcome === "invalid_handle") {
        setError("Enter a valid X handle.");
        setHandleResult(null);
        return;
      }
      setHandleResult(audit);
    } catch {
      setError("Handle audit failed.");
      setHandleResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wl-admin-wallets">
      <div className="wl-admin__page-header">
        <div>
          <h1 className="wl-admin__page-title">Wallet & Handle Audit</h1>
          <p className="wl-admin__page-lead">
            Cross-check whitelist, FCFS, crossover, and identity conflicts.
          </p>
          <p className="wl-admin__muted">
            <Link to="/admin/clearance">← Clearance Overview</Link>
          </p>
        </div>
      </div>

      <div className="wl-admin__filters">
        <select
          className="wl-admin__field-input"
          value={mode}
          onChange={(event) => setMode(event.target.value as "wallet" | "handle")}
        >
          <option value="wallet">Search by wallet</option>
          <option value="handle">Search by X handle</option>
        </select>
        {mode === "wallet" ? (
          <>
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
                  void runWalletAudit();
                }
              }}
            />
            <button
              type="button"
              className="wl-admin__btn wl-admin__btn--primary"
              disabled={loading}
              onClick={() => void runWalletAudit()}
            >
              {loading ? "Searching…" : "Run Wallet Audit"}
            </button>
          </>
        ) : (
          <>
            <input
              className="wl-admin__field-input"
              type="text"
              placeholder="@username"
              value={handle}
              spellCheck={false}
              onChange={(event) => setHandle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void runHandleAudit();
                }
              }}
            />
            <button
              type="button"
              className="wl-admin__btn wl-admin__btn--primary"
              disabled={loading}
              onClick={() => void runHandleAudit()}
            >
              {loading ? "Searching…" : "Run Handle Audit"}
            </button>
          </>
        )}
      </div>

      {error ? (
        <p className="wl-admin__error" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="wl-admin__card">
          <h2 className="wl-admin__card-title">Wallet results</h2>
          <p>
            Wallet: <code>{result.wallet_address_normalised}</code>
          </p>
          <p>
            Whitelist record:{" "}
            <strong>{result.on_whitelist ? "YES" : "NO"}</strong>
          </p>
          {result.on_whitelist && result.fcfs_applications?.length ? (
            <p>
              <span className="wl-admin__badge">VALID CROSSOVER</span> Wallet
              appears on both WL and FCFS.
            </p>
          ) : null}

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
                    <Link to={`/admin/clearance/fcfs?${params.toString()}`}>
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

      {handleResult ? (
        <div className="wl-admin__card">
          <h2 className="wl-admin__card-title">Handle results</h2>
          <p>
            Handle: <code>@{handleResult.x_handle_normalised}</code>
          </p>
          {handleResult.identity_conflict ? (
            <p className="wl-admin__error">
              CROSS-LIST IDENTITY CONFLICT: handle linked to multiple wallets.
            </p>
          ) : null}
          {(handleResult.fcfs_applications ?? []).map((entry) => {
            const app = entry.application as {
              id: string;
              wallet_address: string;
              x_handle: string;
              status: FcfsApplicationStatus;
              submitted_at: string;
            };
            return (
              <div key={app.id} className="wl-admin__audit-card">
                <p>
                  Wallet: <code>{app.wallet_address}</code>
                  {entry.on_whitelist ? (
                    <span className="wl-admin__badge"> ON WL</span>
                  ) : null}
                </p>
                <p>
                  Status:{" "}
                  {fcfsStatusLabel(app.status as FcfsApplicationStatus)}
                </p>
                <p>Submitted: {formatDateTime(app.submitted_at)}</p>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
