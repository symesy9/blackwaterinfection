import { RATTOBER_CATEGORY_LABELS, type RattoberCategoryId } from "../config/categories";

type TraitStepperProps = {
  category: RattoberCategoryId;
  selectedIndex: number | null;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
};

export default function TraitStepper({
  category,
  selectedIndex,
  total,
  onPrevious,
  onNext,
}: TraitStepperProps) {
  const label = RATTOBER_CATEGORY_LABELS[category];
  const display =
    total === 0
      ? "0 / 0"
      : selectedIndex == null
        ? `— / ${total}`
        : `${selectedIndex + 1} / ${total}`;

  return (
    <div className="rt-stepper">
      <button
        type="button"
        className="rt-stepper__btn"
        aria-label={`Previous ${label} trait`}
        onClick={onPrevious}
        disabled={total === 0}
      >
        ‹
      </button>
      <div className="rt-stepper__label">
        <span>{label}</span>
        <span className="rt-stepper__count">{display}</span>
      </div>
      <button
        type="button"
        className="rt-stepper__btn"
        aria-label={`Next ${label} trait`}
        onClick={onNext}
        disabled={total === 0}
      >
        ›
      </button>
    </div>
  );
}
