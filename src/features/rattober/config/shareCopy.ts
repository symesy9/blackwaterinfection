/** Single source for Rattober share caption — update here only. */
export const RATTOBER_SHARE_CAPTION = `I built my Rattober rat 🐀

Build yours at Blackwater Labs.

#Rattober`;

export function rattoberShareUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/rattober`;
  }
  return "https://blackwater-labs.com/rattober";
}

export function rattoberShareTextWithUrl(): string {
  return `${RATTOBER_SHARE_CAPTION}\n\n${rattoberShareUrl()}`;
}

export function rattoberDownloadFilename(subjectId?: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  if (subjectId) {
    return `blackwater-rattober-${subjectId.toLowerCase()}-${stamp}.png`;
  }
  return `blackwater-rattober-rat-${stamp}.png`;
}

export function xComposeIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
