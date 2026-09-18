import type { ReactNode } from "react";

type BulkSelectionBarProps = {
  entityLabel: string;
  pageCount: number;
  matchingTotal: number;
  selectedCount: number;
  mode: "none" | "page" | "all_matching";
  onSelectPage: () => void;
  onSelectAllMatching: () => void;
  onClear: () => void;
  children?: ReactNode;
};

export default function BulkSelectionBar({
  entityLabel,
  pageCount,
  matchingTotal,
  selectedCount,
  mode,
  onSelectPage,
  onSelectAllMatching,
  onClear,
  children,
}: BulkSelectionBarProps) {
  if (selectedCount === 0 && mode === "none") {
    return (
      <div className="wl-admin__bulk-bar">
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--ghost"
          disabled={pageCount === 0}
          onClick={onSelectPage}
        >
          Select page
        </button>
      </div>
    );
  }

  return (
    <div className="wl-admin__bulk-bar">
      <span>
        {selectedCount.toLocaleString()} {entityLabel} selected
        {mode === "page" && matchingTotal > pageCount ? (
          <>
            {" "}
            ·{" "}
            <button
              type="button"
              className="wl-admin__link-btn"
              onClick={onSelectAllMatching}
            >
              Select all {matchingTotal.toLocaleString()} matching {entityLabel}
            </button>
          </>
        ) : null}
        {mode === "all_matching" ? (
          <strong> (all matching filter)</strong>
        ) : null}
      </span>
      <button
        type="button"
        className="wl-admin__btn wl-admin__btn--ghost"
        onClick={onClear}
      >
        Clear selection
      </button>
      {children}
    </div>
  );
}
