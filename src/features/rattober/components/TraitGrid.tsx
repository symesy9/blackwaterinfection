import type { RattoberCategoryId } from "../config/categories";
import type { RattoberTrait } from "../lib/traits";
import { traitAssetUrl } from "../lib/traits";

type TraitGridProps = {
  category: RattoberCategoryId;
  traits: RattoberTrait[];
  selectedId: string | null;
  onSelect: (traitId: string) => void;
};

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
            >
              <span className="rt-grid__thumb">
                <img
                  src={traitAssetUrl(category, trait.file)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span className="rt-grid__name">{trait.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
