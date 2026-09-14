import { useEffect, useId, useState } from "react";
import SiteShell from "../components/site/SiteShell";
import { FAQ_ITEMS } from "../lib/faqs";

export default function FaqsPage() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);
  const baseId = useId();

  useEffect(() => {
    document.title = "FAQs — Blackwater Labs";
  }, []);

  return (
    <SiteShell>
      <section className="bw-site-page">
        <header className="bw-site-page__header">
          <p className="bw-site-page__eyebrow">Blackwater Labs</p>
          <h1 className="bw-site-page__title">FAQs</h1>
          <p className="bw-site-page__lead">
            Mint details, FCFS, whitelist, and official channels — answers pulled from current
            project info.
          </p>
        </header>

        <div className="bw-faqs">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            const panelId = `${baseId}-${item.id}`;

            return (
              <article key={item.id} className="bw-faqs__item">
                <h2 className="bw-faqs__heading">
                  <button
                    type="button"
                    className="bw-faqs__trigger"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                  >
                    <span className="bw-faqs__category">{item.category}</span>
                    <span className="bw-faqs__question">{item.question}</span>
                    <span className="bw-faqs__icon" aria-hidden="true">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                </h2>
                <div
                  id={panelId}
                  className={`bw-faqs__panel${isOpen ? " is-open" : ""}`}
                  hidden={!isOpen}
                >
                  <p>{item.answer}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </SiteShell>
  );
}
