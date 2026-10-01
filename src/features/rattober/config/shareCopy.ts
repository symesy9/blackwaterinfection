import { BLACKWATER_PUBLIC_SITE_ORIGIN } from "../../../lib/blackwaterLinks";

/** Default tweet body — URL and #Rattober are appended in rattoberShareTextWithUrl(). */
export const RATTOBER_SHARE_CAPTION = `My Rattober Rat has escaped 🐀

Build yours and show me what you get 👀`;

/** Subtle status after Share to X (download + compose). */
export const RATTOBER_SHARE_X_SAVED_MESSAGE =
  "IMAGE SAVED — ATTACH IT TO YOUR X POST.";

export const RATTOBER_SHARE_X_POPUP_BLOCKED_MESSAGE =
  "IMAGE SAVED — ALLOW POP-UPS TO OPEN X, THEN ATTACH YOUR PNG.";

export function rattoberShareUrl(): string {
  const origin = globalThis.window?.location?.origin;
  if (origin) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const path = base ? `${base}/rattober` : "/rattober";
    return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return `${BLACKWATER_PUBLIC_SITE_ORIGIN}/rattober`;
}

export function rattoberShareTextWithUrl(): string {
  return `${RATTOBER_SHARE_CAPTION}\n\n${rattoberShareUrl()}\n\n#Rattober`;
}

export function rattoberDownloadFilename(subjectId?: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  if (subjectId) {
    return `blackwater-rattober-${subjectId.toLowerCase()}-${stamp}.png`;
  }
  return `blackwater-rattober-rat-${stamp}.png`;
}

export function xComposeIntentUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
