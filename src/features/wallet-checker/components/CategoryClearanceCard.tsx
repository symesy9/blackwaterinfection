import { Link } from "react-router-dom";
import { publicStatusClass } from "../lib/statusMapping";
import type { CategoryClearanceDisplay } from "../lib/types";

interface CategoryClearanceCardProps {
  clearance: CategoryClearanceDisplay;
}

export default function CategoryClearanceCard({
  clearance,
}: CategoryClearanceCardProps) {
  const statusClass = publicStatusClass(clearance.publicStatus);
  const showCheck = clearance.publicStatus === "APPROVED";

  return (
    <article
      className={`wc-card wc-card--${statusClass}`}
      aria-label={`${clearance.category} clearance`}
    >
      <header className="wc-card__header">
        <h3 className="wc-card__category">{clearance.category}</h3>
        <p className="wc-card__status">
          {showCheck ? <span className="wc-card__check" aria-hidden="true">✓ </span> : null}
          {clearance.publicStatus}
        </p>
      </header>

      {clearance.allocation ? (
        <p className="wc-card__allocation">
          ALLOCATION: {clearance.allocation}
        </p>
      ) : null}

      {clearance.price ? (
        <p className="wc-card__price">PRICE: {clearance.price}</p>
      ) : null}

      {clearance.supportingLine ? (
        <p className="wc-card__support">{clearance.supportingLine}</p>
      ) : null}

      {clearance.showFcfsApplyLink ? (
        <Link className="wc-card__link" to="/fcfs">
          APPLY FOR FCFS →
        </Link>
      ) : null}
    </article>
  );
}
