import { HOME_ASSETS } from "../../../lib/homeAssets";
import type { RattoberSelection } from "../lib/compositeCanvas";
import { resolveRenderStack } from "../lib/layerStack";
import { findTraitById, traitAssetUrl } from "../lib/traits";

type RatPreviewProps = {
  selection: RattoberSelection;
  subjectId: string;
  idle: boolean;
  refreshing: boolean;
};

export default function RatPreview({
  selection,
  subjectId,
  idle,
  refreshing,
}: RatPreviewProps) {
  const statusLabel = idle
    ? "STATUS // AWAITING CONFIGURATION"
    : refreshing
      ? "STATUS // UPDATING SUBJECT…"
      : "STATUS // CONFIGURABLE";

  const stack = idle
    ? []
    : resolveRenderStack(selection, { includeStructural: true });

  return (
    <div className="rt-preview">
      <div className="rt-preview__frame">
        <p className="rt-preview__label">SUBJECT // {subjectId}</p>
        <div
          className={`rt-preview__viewport${refreshing ? " is-refreshing" : ""}`}
          aria-live="polite"
        >
          {idle ? (
            <img
              className="rt-preview__layer rt-preview__logo"
              src={HOME_ASSETS.headerLogo}
              alt="Blackwater Labs"
              decoding="async"
            />
          ) : (
            <div className="rt-preview__stack">
              {stack.map(({ category, traitId }, index) => {
                const trait = findTraitById(category, traitId);
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
                    data-rt-layer={import.meta.env.DEV ? category : undefined}
                    onError={(event) => {
                      const img = event.currentTarget;
                      if (img.src !== full) img.src = full;
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
        <p className="rt-preview__status">{statusLabel}</p>
      </div>
    </div>
  );
}
