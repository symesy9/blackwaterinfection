import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import SiteShell from "../components/site/SiteShell";
import { LOG_ENTRIES } from "../lib/logs";

export default function LogDetailPage() {
  const { slug } = useParams();
  const entry = LOG_ENTRIES.find((item) => item.slug === slug);

  useEffect(() => {
    document.title = entry
      ? `${entry.title} — Blackwater Logs`
      : "Log — Blackwater Labs";
  }, [entry]);

  if (!entry) {
    return <Navigate to="/logs" replace />;
  }

  return (
    <SiteShell>
      <article className="bw-site-page bw-log-detail">
        <p className="bw-site-page__eyebrow">
          <Link to="/logs" className="bw-log-detail__back">
            ← Recovered Logs
          </Link>
        </p>
        <header className="bw-site-page__header bw-site-page__header--left">
          <p className="bw-logs__category">{entry.category}</p>
          <h1 className="bw-site-page__title">{entry.title}</h1>
          <div className="bw-log-detail__meta">
            <span className="bw-logs__date">{entry.date}</span>
            <span className={`bw-logs__status bw-logs__status--${entry.status.toLowerCase()}`}>
              {entry.status}
            </span>
          </div>
        </header>

        <div className="bw-log-detail__content">
          <p className="bw-log-detail__placeholder" role="status">
            PLACEHOLDER — Full article content for <strong>{entry.title}</strong> has not yet
            been supplied. Replace this block when the final record is ready.
          </p>
          <p className="bw-log-detail__excerpt">{entry.excerpt}</p>
        </div>
      </article>
    </SiteShell>
  );
}
