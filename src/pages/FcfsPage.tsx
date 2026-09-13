import { useEffect } from "react";
import RzAmbientStage from "../components/RzAmbientStage";
import FcfsApplicationForm from "../features/fcfs/components/FcfsApplicationForm";
import { isSupabaseConfigured } from "../features/whitelist/lib/supabase";

export default function FcfsPage() {
  useEffect(() => {
    document.title = "FCFS Clearance — Blackwater Labs";
  }, []);

  return (
    <RzAmbientStage>
      <section className="fcfs-page">
        <header className="fcfs-page__header">
          <p className="fcfs-page__eyebrow">BLACKWATER LABS</p>
          <h1 className="fcfs-page__title">FCFS Clearance</h1>
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
    </RzAmbientStage>
  );
}
