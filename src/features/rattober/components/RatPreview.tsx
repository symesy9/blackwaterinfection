import { HOME_ASSETS } from "../../../lib/homeAssets";
import { RATTOBER_RENDER_ORDER } from "../config/categories";
import type { RattoberSelection } from "../lib/compositeCanvas";
import { findTraitById, traitAssetUrl } from "../lib/traits";

type RatPreviewProps = {
  selection: RattoberSelection;
  subjectId: string;
  idle: boolean;
  loading: boolean;
};

export default function RatPreview({
  selection,
  subjectId,
  idle,
  loading,
}: RatPreviewProps) {
  const statusLabel = idle
    ? "STATUS // AWAITING CONFIGURATION"
    : loading
      ? "STATUS // LOADING SUBJECT…"
      : "STATUS // CONFIGURABLE";

  const showLayers = !idle && !loading;

  return (
    <div className="rt-preview">
      <div className="rt-preview__frame">
        <p className="rt-preview__label">SUBJECT // {subjectId}</p>
        <div className="rt-preview__viewport" aria-live="polite">
          {idle ? (
            <img
              className="rt-preview__layer rt-preview__logo"
              src={HOME_ASSETS.headerLogo}
              alt="Blackwater Labs"
              decoding="async"
            />
          ) : null}
          {!idle && loading ? (
            <p className="rt-preview__loading">LOADING SUBJECT…</p>
          ) : null}
          {showLayers ? (
            <div className="rt-preview__stack">
              {RATTOBER_RENDER_ORDER.map((category, index) => {
                const trait = findTraitById(category, selection[category]);
                if (!trait) return null;
                const src = traitAssetUrl(category, trait.file, "preview");
                const full = traitAssetUrl(category, trait.file, "full");
                return (
                  <img
                    key={`${category}-${trait.id}`}
                    className="rt-preview__layer"
                    style={{ zIndex: index + 1 }}
                    src={src}
                    alt=""
                    decoding="async"
                    fetchPriority={index === 0 ? "high" : "auto"}
                    onError={(event) => {
                      const img = event.currentTarget;
                      if (img.src !== full) img.src = full;
                    }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
        <p className="rt-preview__status">{statusLabel}</p>
      </div>
    </div>
  );
}
