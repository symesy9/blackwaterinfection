import {
  RATTOBER_CATEGORY_LABELS,
  RATTOBER_UI_ORDER,
  type RattoberCategoryId,
} from "../config/categories";

type CategoryTabsProps = {
  active: RattoberCategoryId;
  onChange: (category: RattoberCategoryId) => void;
};

export default function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div className="rt-tabs" role="tablist" aria-label="Trait categories">
      {RATTOBER_UI_ORDER.map((category) => (
        <button
          key={category}
          type="button"
          role="tab"
          aria-selected={active === category}
          className={`rt-tabs__btn${active === category ? " is-active" : ""}`}
          onClick={() => onChange(category)}
        >
          {RATTOBER_CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  );
}
