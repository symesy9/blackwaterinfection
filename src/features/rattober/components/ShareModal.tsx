import { useEffect, useState } from "react";
import {
  copyRattoberCaption,
  downloadRatBlob,
  openXComposeWithCaption,
  shareRatToX,
  shouldUseNativeWebShare,
  tryNativeShareRat,
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
  const [busy, setBusy] = useState(false);
  const nativeShare = shouldUseNativeWebShare();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleShareToX = async () => {
    if (!blob || busy) return;
    setBusy(true);
    try {
      const caption = await shareRatToX(blob, subjectId);
      onFeedback(
        caption === "caption-copied"
          ? "Caption copied. Attach the downloaded PNG in X."
          : "X opened — paste caption and attach the downloaded PNG.",
      );
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleNativeShare = async () => {
    if (!blob || busy) return;
    setBusy(true);
    try {
      const result = await tryNativeShareRat(blob, subjectId);
      if (result === "shared") onClose();
      if (result === "cancelled") return;
      onFeedback("System share unavailable — use Share to X instead.");
    } finally {
      setBusy(false);
    }
  };

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
          SHARE YOUR RAT
        </h2>
        <p className="rt-modal__lead">
          Share to X downloads your rat, copies the caption, and opens the post
          composer — attach the PNG in X before posting.
        </p>
        <div className="rt-modal__actions">
          <button
            type="button"
            className="rt-btn rt-btn--primary"
            disabled={!blob || busy}
            onClick={() => void handleShareToX()}
          >
            {busy ? "PROCESSING…" : "SHARE TO X"}
          </button>
          {nativeShare ? (
            <button
              type="button"
              className="rt-btn rt-btn--ghost"
              disabled={!blob || busy}
              onClick={() => void handleNativeShare()}
            >
              MORE OPTIONS…
            </button>
          ) : null}
          <button
            type="button"
            className="rt-btn rt-btn--ghost"
            disabled={!blob}
            onClick={() => {
              if (!blob) return;
              downloadRatBlob(blob, subjectId);
              onFeedback("Image downloaded.");
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
            OPEN X (CAPTION ONLY)
          </button>
          <button type="button" className="rt-btn rt-btn--ghost" onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
