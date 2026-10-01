import { downloadBlob } from "../../../lib/mergeInfectionImage";
import {
  rattoberDownloadFilename,
  rattoberShareTextWithUrl,
  rattoberShareUrl,
  xComposeIntentUrl,
} from "../config/shareCopy";

export function downloadRatBlob(blob: Blob, subjectId?: string): void {
  downloadBlob(blob, rattoberDownloadFilename(subjectId));
}

/** Opens X compose with full Rattober caption (URL-encoded). Returns false if pop-up blocked. */
export function openXComposeWithCaption(): boolean {
  const win = globalThis.window;
  if (!win?.open) return false;
  const url = xComposeIntentUrl(rattoberShareTextWithUrl());
  return win.open(url, "_blank", "noopener,noreferrer") != null;
}

export function canNativeShareRatFile(): boolean {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    const probe = new File([new Blob([""], { type: "image/png" })], "probe.png", {
      type: "image/png",
    });
    return navigator.canShare?.({ files: [probe] }) ?? false;
  } catch {
    return false;
  }
}

/** Download PNG, then open X compose — user attaches the saved image in X. */
export function shareRatToX(blob: Blob, subjectId?: string): {
  composeOpened: boolean;
} {
  downloadRatBlob(blob, subjectId);
  const composeOpened = openXComposeWithCaption();
  return { composeOpened };
}

export async function tryNativeShareRat(
  blob: Blob,
  subjectId?: string,
): Promise<"shared" | "unsupported" | "cancelled"> {
  if (!navigator.share) {
    return "unsupported";
  }

  const file = new File([blob], rattoberDownloadFilename(subjectId), {
    type: "image/png",
  });

  const shareData: ShareData = {
    title: "Rattober — Blackwater Labs",
    text: rattoberShareTextWithUrl(),
    url: rattoberShareUrl(),
  };

  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ ...shareData, files: [file] });
      return "shared";
    }
    return "unsupported";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    return "unsupported";
  }
}
