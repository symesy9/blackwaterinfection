import { downloadBlob } from "../../../lib/mergeInfectionImage";
import {
  rattoberDownloadFilename,
  rattoberShareTextWithUrl,
  xComposeIntentUrl,
} from "../config/shareCopy";

export async function copyRattoberCaption(): Promise<void> {
  const text = rattoberShareTextWithUrl();
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard is not available.");
  }
  await navigator.clipboard.writeText(text);
}

export function downloadRatBlob(blob: Blob, subjectId?: string): void {
  downloadBlob(blob, rattoberDownloadFilename(subjectId));
}

export function openXComposeWithCaption(): void {
  window.open(xComposeIntentUrl(rattoberShareTextWithUrl()), "_blank", "noopener,noreferrer");
}

/** Laptops/desktops get the X modal — macOS share sheet rarely lists X. */
export function shouldUseNativeWebShare(): boolean {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  if (window.matchMedia("(pointer: fine)").matches) return false;
  return true;
}

/** Download PNG, copy caption, open X compose (attach image in the X dialog). */
export async function shareRatToX(
  blob: Blob,
  subjectId?: string,
): Promise<"caption-copied" | "caption-failed"> {
  downloadRatBlob(blob, subjectId);
  try {
    await copyRattoberCaption();
    openXComposeWithCaption();
    return "caption-copied";
  } catch {
    openXComposeWithCaption();
    return "caption-failed";
  }
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
    url: typeof window !== "undefined" ? window.location.href : undefined,
  };

  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ ...shareData, files: [file] });
      return "shared";
    }
    await navigator.share(shareData);
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    return "unsupported";
  }
}
