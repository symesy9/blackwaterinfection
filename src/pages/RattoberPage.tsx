import { useEffect } from "react";
import HomeNav from "../components/home/HomeNav";
import { HOME_ASSETS } from "../lib/homeAssets";
import CategoryTabs from "../features/rattober/components/CategoryTabs";
import RatPreview from "../features/rattober/components/RatPreview";
import ShareModal from "../features/rattober/components/ShareModal";
import TraitGrid from "../features/rattober/components/TraitGrid";
import TraitStepper from "../features/rattober/components/TraitStepper";
import { totalTraitCount } from "../features/rattober/lib/traits";
import { useRattoberCreator } from "../features/rattober/hooks/useRattoberCreator";

export default function RattoberPage() {
  const creator = useRattoberCreator();

  useEffect(() => {
    document.title = "Rattober — Blackwater Labs";
    document.documentElement.classList.add("rz2-page-scroll");
    document.body.classList.add("rz2-page-scroll", "bw-rattober-active");

    return () => {
      document.documentElement.classList.remove("rz2-page-scroll");
      document.body.classList.remove("rz2-page-scroll", "bw-rattober-active");
    };
  }, []);

  return (
    <div className="bw-rattober">
      <HomeNav />

      <main className="bw-rattober__shell">
        <div className="bw-rattober__fx" aria-hidden="true">
          <img
            className="bw-rattober__atmosphere"
            src={HOME_ASSETS.atmosphere}
            alt=""
            width={1672}
            height={941}
            decoding="async"
          />
          <img
            className="bw-rattober__lab"
            src={HOME_ASSETS.labOverlay}
            alt=""
            width={1536}
            height={1024}
            loading="lazy"
            decoding="async"
          />
          <div className="bw-rattober__grain" />
          <div className="bw-rattober__vignette" />
        </div>

        <section className="rt-page">
          <header className="rt-page__header">
            <p className="rt-page__eyebrow">BLACKWATER LABS // RATTOBER 2026</p>
            <h1 className="rt-page__title">RATTOBER</h1>
            <h2 className="rt-page__subtitle">BUILD YOUR RAT</h2>
            <p className="rt-page__lead">Build it. Save it. Share it.</p>
          </header>

          {!creator.ready ? (
            <div className="rt-panel rt-panel--warn">
              <p className="rt-panel__title">INITIALISING TRAIT DATABASE…</p>
              <p className="rt-panel__text">
                Trait artwork is not loaded yet. Add 2048×2048 PNGs under{" "}
                <code>public/assets/rattober/</code>, then run{" "}
                <code>npm run rattober:manifest</code> and rebuild.
              </p>
              <p className="rt-panel__text rt-panel__muted">
                Expected categories: backgrounds, skins, clothing, eyes, mouths,
                hats-hair.
              </p>
            </div>
          ) : (
            <div className="rt-creator">
              <div className="rt-creator__preview-col">
                <RatPreview
                  selection={creator.selection}
                  subjectId={creator.subjectId}
                  idle={!creator.characterStarted}
                  loading={creator.characterStarted && !creator.previewReady}
                />
                <div className="rt-actions rt-actions--row">
                  <button
                    type="button"
                    className="rt-btn rt-btn--ghost"
                    onClick={creator.randomise}
                  >
                    RANDOMISE
                  </button>
                  <button
                    type="button"
                    className="rt-btn rt-btn--ghost"
                    onClick={creator.reset}
                  >
                    RESET
                  </button>
                </div>
                <div className="rt-actions rt-actions--stack">
                  <button
                    type="button"
                    className="rt-btn rt-btn--primary"
                    disabled={
                      creator.exporting ||
                      (creator.characterStarted && !creator.previewReady)
                    }
                    aria-disabled={!creator.selectionComplete}
                    onClick={() => void creator.exportRat()}
                  >
                    {creator.exporting ? "PROCESSING…" : "DOWNLOAD RAT"}
                  </button>
                  <button
                    type="button"
                    className="rt-btn rt-btn--ghost"
                    disabled={
                      creator.sharing ||
                      (creator.characterStarted && !creator.previewReady)
                    }
                    aria-disabled={!creator.selectionComplete}
                    onClick={() => void creator.shareRat()}
                  >
                    {creator.sharing ? "PROCESSING…" : "SHARE RAT"}
                  </button>
                </div>
              </div>

              <div className="rt-creator__traits-col">
                <p className="rt-database-label">TRAIT DATABASE — {totalTraitCount()} TRAITS</p>
                <CategoryTabs
                  active={creator.activeCategory}
                  onChange={creator.setActiveCategory}
                />
                <TraitStepper
                  category={creator.activeCategory}
                  selectedIndex={creator.selectedIndex}
                  total={creator.activeTraits.length}
                  onPrevious={() => creator.stepTrait(-1)}
                  onNext={() => creator.stepTrait(1)}
                />
                <TraitGrid
                  category={creator.activeCategory}
                  traits={creator.activeTraits}
                  selectedId={creator.selection[creator.activeCategory]}
                  onSelect={(id) => creator.selectTrait(creator.activeCategory, id)}
                />
              </div>
            </div>
          )}

          {creator.feedback ? (
            <p className="rt-feedback" role="status">
              {creator.feedback}
            </p>
          ) : null}
        </section>
      </main>

      {creator.shareModalOpen ? (
        <ShareModal
          blob={creator.shareBlob}
          subjectId={creator.subjectId}
          onClose={() => creator.setShareModalOpen(false)}
          onFeedback={creator.setFeedback}
        />
      ) : null}
    </div>
  );
}
