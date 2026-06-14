import { getOverlayUrl } from "./infectionOverlays";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawCenteredInRect(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number,
) {
  const scale = Math.min(
    rectWidth / image.naturalWidth,
    rectHeight / image.naturalHeight,
  );
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const offsetX = rectX + (rectWidth - drawWidth) / 2;
  const offsetY = rectY + (rectHeight - drawHeight) / 2;

  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

export async function mergeInfectionImage(
  nftImage: HTMLImageElement,
  overlayFilename: string,
  underlayFilename?: string,
): Promise<Blob> {
  const overlay = await loadImage(getOverlayUrl(overlayFilename));
  const underlay = underlayFilename
    ? await loadImage(getOverlayUrl(underlayFilename))
    : null;

  const nftWidth = nftImage.naturalWidth;
  const nftHeight = nftImage.naturalHeight;
  const underlayHeight = underlay
    ? Math.round(nftWidth * (underlay.naturalHeight / underlay.naturalWidth))
    : 0;

  const canvas = document.createElement("canvas");
  canvas.width = nftWidth;
  canvas.height = nftHeight + underlayHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported in this browser.");
  }

  if (underlay) {
    ctx.drawImage(underlay, 0, nftHeight, nftWidth, underlayHeight);
  }

  ctx.drawImage(nftImage, 0, 0, nftWidth, nftHeight);
  drawCenteredInRect(ctx, overlay, 0, 0, nftWidth, nftHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to generate infected image."));
          return;
        }
        resolve(blob);
      },
      "image/png",
      1,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function infectedFilename(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "nft";
  return `infected-${base}.png`;
}

export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write) {
    throw new Error("Clipboard image copy is not supported.");
  }

  const pngBlob =
    blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });

  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": Promise.resolve(pngBlob),
    }),
  ]);
}

/** iPhone / iPad / Android — native share attaches image directly to X. */
export function prefersMobileXShare(): boolean {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return true;
  if (/iPhone|iPod|iPad/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

/** Shrink large infected PNGs so clipboard + X paste work reliably. */
async function blobForShare(blob: Blob, maxWidth = 1200): Promise<Blob> {
  if (blob.size <= 1.5 * 1024 * 1024) return blob;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / (img.naturalWidth || maxWidth));
      const width = Math.max(1, Math.round((img.naturalWidth || maxWidth) * scale));
      const height = Math.max(1, Math.round((img.naturalHeight || maxWidth) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(blob);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((next) => resolve(next ?? blob), "image/png", 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
}

export const X_INFECTION_SHARE_TEXT = `⚠️ INFECTION CONFIRMED ⚠️

I have been registered as a Blackwater Subject.

Containment protocols have failed.

How many more have been exposed?

#BLACKWATERINFECTION`;

function buildXIntentUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

/** Opens X compose with pre-filled message. */
export function openXCompose(text: string): void {
  const url = buildXIntentUrl(text);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
}

export type ShareInfectedResult = "native-share" | "x-text";

/** Phone / iPad: share sheet with image + text. Desktop uses openXCompose instead. */
export async function shareInfectedToX(
  blob: Blob,
  text: string = X_INFECTION_SHARE_TEXT,
): Promise<ShareInfectedResult> {
  const shareBlob = await blobForShare(blob);
  const file = new File([shareBlob], "infected-pfp.png", { type: "image/png" });

  for (const payload of [{ files: [file], text }, { files: [file] }]) {
    try {
      if (navigator.canShare && !navigator.canShare(payload)) continue;
      await navigator.share(payload);
      return "native-share";
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
    }
  }

  openXCompose(text);
  return "x-text";
}
