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

export const X_INFECTION_SHARE_TEXT = `⚠️ INFECTION CONFIRMED ⚠️

I have been registered as a Blackwater Subject.

Containment protocols have failed.

How many more have been exposed?

#BLACKWATERINFECTION`;

/** Opens X compose in the app (mobile) or a new tab (desktop). Call synchronously from a click handler. */
export function openXCompose(text: string): boolean {
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(url);
    return true;
  }
  return true;
}

export type ShareInfectedResult = "x-compose" | "downloaded";

/**
 * Opens X compose with pre-filled copy, then puts the infected PFP on the
 * clipboard so the user can paste it into the open post.
 * X must open synchronously from the click handler to avoid popup blockers.
 */
export async function shareInfectedToX(
  blob: Blob,
  text: string = X_INFECTION_SHARE_TEXT,
): Promise<ShareInfectedResult> {
  openXCompose(text);

  try {
    await copyBlobToClipboard(blob);
    return "x-compose";
  } catch {
    downloadBlob(blob, "infected-pfp.png");
    return "downloaded";
  }
}
