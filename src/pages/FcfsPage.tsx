import { useEffect } from "react";
import HomeNav from "../components/home/HomeNav";
import FcfsApplicationForm from "../features/fcfs/components/FcfsApplicationForm";
import { isSupabaseConfigured } from "../features/whitelist/lib/supabase";
import { HOME_ASSETS } from "../lib/homeAssets";

export default function FcfsPage() {
  useEffect(() => {
    document.title = "FCFS Clearance — Blackwater Labs";
    document.documentElement.classList.add("rz2-page-scroll");
    document.body.classList.add("rz2-page-scroll", "bw-fcfs-active");

    return () => {
      document.documentElement.classList.remove("rz2-page-scroll");
      document.body.classList.remove("rz2-page-scroll", "bw-fcfs-active");
    };
  }, []);

  return (
    <div className="bw-fcfs">
      <HomeNav />

      <main className="bw-fcfs__shell">
        <div className="bw-fcfs__fx" aria-hidden="true">
          <img
            className="bw-fcfs__atmosphere"
            src={HOME_ASSETS.atmosphere}
            alt=""
            width={1672}
            height={941}
            decoding="async"
          />
          <div className="bw-fcfs__grain" />
          <div className="bw-fcfs__vignette" />
        </div>

        <section className="fcfs-page">
          <header className="fcfs-page__header">
            <p className="fcfs-page__eyebrow">Blackwater Labs</p>
            <h1 className="fcfs-page__title">
              APPLY FOR FCFS<span className="fcfs-page__title-arrow"> →</span>
            </h1>
            <p className="fcfs-page__lead">
              Complete the clearance sequence to apply for FCFS mint eligibility.
              Follow → Share → X Handle → Wallet → Apply.
            </p>
          </header>

          {!isSupabaseConfigured() ? (
            <p className="fcfs-page__unavailable" role="alert">
              FCFS applications are temporarily unavailable.
            </p>
          ) : (
            <FcfsApplicationForm />
          )}
        </section>
      </main>
    </div>
  );
}
