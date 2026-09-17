import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fcfsFiltersToSearchParams } from "../features/fcfs/hooks/useFcfsAdminFilters";
import {
  fetchFcfsBurstWindows,
  fetchFcfsSubmissionTimeline,
  getFcfsAuditSummary,
} from "../features/fcfs/lib/adminApi";
import { formatDateTime } from "../features/fcfs/lib/format";
import type {
  FcfsAuditFilter,
  FcfsAuditSummary,
  FcfsBurstWindow,
  FcfsTimelinePeriod,
} from "../features/fcfs/lib/types";

export default function AdminFcfsAuditPage() {
  const [summary, setSummary] = useState<FcfsAuditSummary | null>(null);
  const [timeline, setTimeline] = useState<FcfsTimelinePeriod[]>([]);
  const [bursts, setBursts] = useState<FcfsBurstWindow[]>([]);
  const [granularity, setGranularity] = useState<"day" | "hour" | "minute">(
    "hour",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, timelineData, burstData] = await Promise.all([
        getFcfsAuditSummary(),
        fetchFcfsSubmissionTimeline(granularity),
        fetchFcfsBurstWindows(),
      ]);
      setSummary(summaryData);
      setTimeline(timelineData);
      setBursts(burstData);
    } catch {
      setError("Failed to load FCFS audit data.");
    } finally {
      setLoading(false);
    }
  }, [granularity]);

  useEffect(() => {
    document.title = "FCFS Audit — Blackwater Labs Admin";
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filterLink = (audit: FcfsAuditFilter) => {
    const params = fcfsFiltersToSearchParams({
      auditFilter: audit,
      page: 1,
    });
    return `/admin/fcfs?${params.toString()}`;
  };

  return (
    <div className="wl-admin-wallets">
      <div className="wl-admin__page-header">
        <div>
          <h1 className="wl-admin__page-title">FCFS Audit</h1>
          <p className="wl-admin__page-lead">
            Objective signals for human review. Nothing here auto-rejects
            applications.
          </p>
          <p className="wl-admin__muted">
            <Link to="/admin/fcfs">← Back to FCFS Applications</Link>
          </p>
        </div>
      </div>

      {error ? (
        <p className="wl-admin__error" role="alert">
          {error}
        </p>
      ) : null}

      {loading || !summary ? (
        <p className="wl-admin__loading">Loading audit summary…</p>
      ) : (
        <>
          <div className="wl-admin__cards wl-admin__cards--audit">
            <div className="wl-admin__card">
              <span className="wl-admin__card-label">Total applications</span>
              <span className="wl-admin__card-value">{summary.total}</span>
            </div>
            <div className="wl-admin__card">
              <span className="wl-admin__card-label">Pending</span>
              <span className="wl-admin__card-value">
                <Link to={filterLink("pending")}>{summary.pending}</Link>
              </span>
            </div>
            <div className="wl-admin__card">
              <span className="wl-admin__card-label">Approved</span>
              <span className="wl-admin__card-value">
                <Link to={filterLink("approved")}>{summary.approved}</Link>
              </span>
            </div>
            <div className="wl-admin__card">
              <span className="wl-admin__card-label">Flagged for review</span>
              <span className="wl-admin__card-value">
                <Link to={filterLink("flagged")}>
                  {summary.flagged_for_review}
                </Link>
              </span>
            </div>
            <div className="wl-admin__card">
              <span className="wl-admin__card-label">Duplicate X handles</span>
              <span className="wl-admin__card-value">
                <Link to={filterLink("duplicate_x_handle")}>
                  {summary.duplicate_x_handles}
                </Link>
              </span>
            </div>
            <div className="wl-admin__card">
              <span className="wl-admin__card-label">Invalid wallet format</span>
              <span className="wl-admin__card-value">
                <Link to={filterLink("invalid_wallet")}>
                  {summary.invalid_wallet_format}
                </Link>
              </span>
            </div>
            <div className="wl-admin__card">
              <span className="wl-admin__card-label">Submission bursts</span>
              <span className="wl-admin__card-value">
                {summary.submission_burst_periods}
              </span>
            </div>
          </div>

          <section className="wl-admin__section">
            <div className="wl-admin__section-header">
              <h2 className="wl-admin__section-title">Submission activity</h2>
              <select
                className="wl-admin__field-input"
                value={granularity}
                onChange={(event) =>
                  setGranularity(event.target.value as "day" | "hour" | "minute")
                }
              >
                <option value="day">By day</option>
                <option value="hour">By hour</option>
                <option value="minute">By minute (top periods)</option>
              </select>
            </div>
            <div className="wl-admin__table-wrap">
              <table className="wl-admin__table">
                <thead>
                  <tr>
                    <th>Date / time</th>
                    <th>Application count</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.length === 0 ? (
                    <tr>
                      <td colSpan={2}>No submission activity recorded.</td>
                    </tr>
                  ) : (
                    timeline.map((period) => (
                      <tr key={period.period_start}>
                        <td>{formatDateTime(period.period_start)}</td>
                        <td>{period.application_count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="wl-admin__section">
            <h2 className="wl-admin__section-title">Submission burst windows</h2>
            <p className="wl-admin__muted">
              2-minute windows with 5 or more applications. Click a row to inspect
              that burst in the applications list.
            </p>
            <div className="wl-admin__table-wrap">
              <table className="wl-admin__table">
                <thead>
                  <tr>
                    <th>Window start</th>
                    <th>Window end</th>
                    <th>Applications</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {bursts.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No submission bursts detected.</td>
                    </tr>
                  ) : (
                    bursts.map((burst) => {
                      const params = fcfsFiltersToSearchParams({
                        auditFilter: "submission_burst",
                        burstStart: burst.bucket_start,
                        burstEnd: burst.bucket_end,
                        hideBursts: false,
                        page: 1,
                      });
                      return (
                        <tr key={`${burst.bucket_start}-${burst.bucket_end}`}>
                          <td>{formatDateTime(burst.bucket_start)}</td>
                          <td>{formatDateTime(burst.bucket_end)}</td>
                          <td>{burst.application_count}</td>
                          <td>
                            <Link to={`/admin/fcfs?${params.toString()}`}>
                              View applications
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
