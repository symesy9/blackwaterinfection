import { useEffect } from "react";
import HomeNav from "../components/home/HomeNav";
import WalletCheckerForm from "../features/wallet-checker/components/WalletCheckerForm";
import { HOME_ASSETS } from "../lib/homeAssets";

export default function WalletCheckerPage() {
  useEffect(() => {
    document.title = "Wallet Checker — Blackwater Labs";
    document.documentElement.classList.add("rz2-page-scroll");
    document.body.classList.add("rz2-page-scroll", "bw-whitelist-active");

    return () => {
      document.documentElement.classList.remove("rz2-page-scroll");
      document.body.classList.remove("rz2-page-scroll", "bw-whitelist-active");
    };
  }, []);

  return (
    <div className="bw-whitelist">
      <HomeNav />

      <main className="bw-whitelist__shell">
        <div className="bw-whitelist__fx" aria-hidden="true">
          <img
            className="bw-whitelist__atmosphere"
            src={HOME_ASSETS.atmosphere}
            alt=""
            width={1672}
            height={941}
            decoding="async"
          />
          <img
            className="bw-whitelist__lab"
            src={HOME_ASSETS.labOverlay}
            alt=""
            width={1536}
            height={1024}
            loading="lazy"
            decoding="async"
          />
          <div className="bw-whitelist__grain" />
          <div className="bw-whitelist__vignette" />
        </div>

        <section className="wl-page">
          <header className="wl-page__header">
            <p className="wl-page__eyebrow">Check Your Clearance</p>
            <h1 className="wl-page__title">
              WALLET CHECKER<span className="wl-page__title-arrow"> →</span>
            </h1>
            <p className="wl-page__lead">
              Enter your Ethereum wallet address to see your current Blackwater
              mint eligibility across whitelist and FCFS — one lookup, both
              categories.
            </p>
          </header>
          <WalletCheckerForm />
        </section>
      </main>
    </div>
  );
}
