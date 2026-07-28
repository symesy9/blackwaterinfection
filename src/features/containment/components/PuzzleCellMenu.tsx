import { useLayoutEffect, useRef, useState } from "react";
import type { PuzzleCell } from "../types/puzzle";

export interface CellMenuAnchor {
  x: number;
  y: number;
}

interface PuzzleCellMenuProps {
  anchor: CellMenuAnchor;
  wrapRef: React.RefObject<HTMLElement | null>;
  selectedCell: PuzzleCell;
  locks: number;
  onScan: () => void;
  onLock: () => void;
  onClose: () => void;
}

function canScan(cell: PuzzleCell): boolean {
  return !cell.isCore && cell.state === "hidden";
}

function canLock(cell: PuzzleCell): boolean {
  return !cell.isCore && cell.state !== "locked";
}

export default function PuzzleCellMenu({
  anchor,
  wrapRef,
  selectedCell,
  locks,
  onScan,
  onLock,
  onClose,
}: PuzzleCellMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(anchor);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const wrap = wrapRef.current;
    if (!menu || !wrap) {
      setPosition(anchor);
      return;
    }

    const pad = 10;
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    const ww = wrap.clientWidth;
    const wh = wrap.clientHeight;

    const x = Math.min(Math.max(mw / 2 + pad, anchor.x), ww - mw / 2 - pad);
    const y = Math.min(Math.max(mh + pad, anchor.y), wh - pad);
    setPosition({ x, y });
  }, [anchor, wrapRef, selectedCell.id]);

  const scanReady = canScan(selectedCell);
  const lockReady = canLock(selectedCell);

  return (
    <div
      ref={menuRef}
      className="cp-cell-menu"
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label="Room actions"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="cp-cell-menu__head">
        <span className="cp-cell-menu__eyebrow">Room actions</span>
        <button type="button" className="cp-cell-menu__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="cp-cell-menu__actions">
        {scanReady && (
          <button
            type="button"
            className="cp-cell-menu__btn cp-cell-menu__btn--scan"
            onClick={onScan}
          >
            Scan
          </button>
        )}
        {lockReady && (
          <button
            type="button"
            className="cp-cell-menu__btn cp-cell-menu__btn--lock"
            disabled={locks <= 0}
            onClick={onLock}
          >
            {locks > 0 ? "Lock" : "No locks"}
          </button>
        )}
      </div>
      {scanReady && (
        <p className="cp-cell-menu__hint">Tap room again to scan quickly</p>
      )}
    </div>
  );
}
