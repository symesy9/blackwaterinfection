import { useEffect } from "react";
import SiteShell from "../components/site/SiteShell";

export default function RoadmapPage() {
  useEffect(() => {
    document.title = "Roadmap — Blackwater Labs";
  }, []);

  return (
    <SiteShell>
      <section className="bw-site-page bw-site-page--coming-soon">
        <header className="bw-site-page__header">
          <p className="bw-site-page__eyebrow">Blackwater Labs</p>
          <h1 className="bw-site-page__title">Roadmap</h1>
        </header>

        <div className="bw-coming-soon">
          <p className="bw-coming-soon__label">COMING SOON!</p>
          <p className="bw-coming-soon__note">
            Facility progression records are being prepared for declassification.
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
