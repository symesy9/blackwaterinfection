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
