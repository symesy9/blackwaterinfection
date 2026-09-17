import { useState } from "react";
import { parseGoToPageInput, paginationRange } from "../lib/audit";

type FcfsPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export default function FcfsPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: FcfsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const { from, to } = paginationRange(page, pageSize, total);
  const [goToValue, setGoToValue] = useState("");

  const pageNumbers = (() => {
    const windowSize = 5;
    const start = Math.max(1, page - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    const adjustedStart = Math.max(1, end - windowSize + 1);
    const numbers: number[] = [];
    for (let current = adjustedStart; current <= end; current += 1) {
      numbers.push(current);
    }
    return numbers;
  })();

  const submitGoTo = () => {
    const next = parseGoToPageInput(goToValue, totalPages);
    if (next === null) return;
    onPageChange(next);
    setGoToValue("");
  };

  return (
    <div className="wl-admin__pagination wl-admin__pagination--fcfs">
      <p className="wl-admin__pagination-summary">
        {total === 0
          ? "Showing 0 applications"
          : `Showing ${from}–${to} of ${total} applications`}
      </p>

      <div className="wl-admin__pagination-controls">
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </button>

        <div className="wl-admin__pagination-pages">
          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={`wl-admin__btn wl-admin__btn--ghost${
                pageNumber === page ? " is-active" : ""
              }`}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
        </div>

        <span className="wl-admin__pagination-label">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--ghost"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Next
        </button>

        <label className="wl-admin__pagination-goto">
          <span className="wl-admin__pagination-goto-label">Go to page</span>
          <input
            className="wl-admin__field-input wl-admin__field-input--small"
            type="text"
            inputMode="numeric"
            value={goToValue}
            onChange={(event) => setGoToValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitGoTo();
              }
            }}
          />
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={submitGoTo}
          >
            Go
          </button>
        </label>
      </div>
    </div>
  );
}
