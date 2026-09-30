import { useEffect } from "react";
import {
  copyRattoberCaption,
  downloadRatBlob,
  openXComposeWithCaption,
} from "../lib/shareRat";

type ShareModalProps = {
  blob: Blob | null;
  subjectId: string;
  onClose: () => void;
  onFeedback: (message: string) => void;
};

export default function ShareModal({
  blob,
  subjectId,
  onClose,
  onFeedback,
}: ShareModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="rt-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="rt-modal"
        role="dialog"
        aria-labelledby="rt-share-title"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="rt-share-title" className="rt-modal__title">
          YOUR RAT IS READY
        </h2>
        <p className="rt-modal__lead">
          Save the image, copy the caption, then open X and attach the PNG manually.
        </p>
        <div className="rt-modal__actions">
          <button
            type="button"
            className="rt-btn rt-btn--primary"
            disabled={!blob}
            onClick={() => {
              if (!blob) return;
              downloadRatBlob(blob, subjectId);
            }}
          >
            DOWNLOAD IMAGE
          </button>
          <button
            type="button"
            className="rt-btn rt-btn--ghost"
            onClick={() => {
              void copyRattoberCaption()
                .then(() => onFeedback("Caption copied."))
                .catch(() => onFeedback("Could not copy caption."));
            }}
          >
            COPY CAPTION
          </button>
          <button
            type="button"
            className="rt-btn rt-btn--ghost"
            onClick={() => openXComposeWithCaption()}
          >
            OPEN X
          </button>
          <button type="button" className="rt-btn rt-btn--ghost" onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
