const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadTraitImage(url: string): Promise<HTMLImageElement> {
  const existing = cache.get(url);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load trait: ${url}`));
    img.src = url;
  });

  cache.set(url, promise);
  return promise;
}

export function preloadTraitUrls(urls: string[]): void {
  for (const url of urls) {
    void loadTraitImage(url).catch(() => {});
  }
}

/** Try optimized URL first (e.g. WebP preview), then fall back to full PNG. */
export function loadTraitImageWithFallback(
  primaryUrl: string,
  fallbackUrl: string,
): Promise<HTMLImageElement> {
  return loadTraitImage(primaryUrl).catch(() => loadTraitImage(fallbackUrl));
}

export function clearTraitImageCacheForTests(): void {
  cache.clear();
}
