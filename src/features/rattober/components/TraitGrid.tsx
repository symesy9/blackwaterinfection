import { useState } from "react";
import type { RattoberCategoryId } from "../config/categories";
import { preloadTraitUrls } from "../lib/imageLoad";
import type { RattoberTrait } from "../lib/traits";
import { traitAssetUrl } from "../lib/traits";

type TraitGridProps = {
  category: RattoberCategoryId;
  traits: RattoberTrait[];
  selectedId: string | null;
  onSelect: (traitId: string) => void;
};

function TraitThumb({
  category,
  file,
}: {
  category: RattoberCategoryId;
  file: string;
}) {
  const [src, setSrc] = useState(() => traitAssetUrl(category, file, "thumb"));
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={loaded ? "is-loaded" : "is-pending"}
      onLoad={() => setLoaded(true)}
      onError={() => {
        const full = traitAssetUrl(category, file, "full");
        if (src !== full) setSrc(full);
      }}
    />
  );
}

export default function TraitGrid({
  category,
  traits,
  selectedId,
  onSelect,
}: TraitGridProps) {
  if (traits.length === 0) {
    return <p className="rt-empty">No traits in this category.</p>;
  }

  return (
    <ul className="rt-grid">
      {traits.map((trait) => {
        const selected = trait.id === selectedId;
        return (
          <li key={trait.id}>
            <button
              type="button"
              className={`rt-grid__tile${selected ? " is-selected" : ""}`}
              aria-label={`${trait.name}${selected ? " (selected)" : ""}`}
              aria-pressed={selected}
              onClick={() => onSelect(trait.id)}
              onMouseEnter={() =>
                preloadTraitUrls([
                  traitAssetUrl(category, trait.file, "preview"),
                  traitAssetUrl(category, trait.file, "full"),
                ])
              }
            >
              <span className="rt-grid__thumb">
                <TraitThumb category={category} file={trait.file} />
              </span>
              <span className="rt-grid__name">{trait.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
