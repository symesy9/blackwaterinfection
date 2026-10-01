const cache = new Map<string, Promise<HTMLImageElement>>();
const loadedUrls = new Set<string>();

export function isTraitImageLoaded(url: string): boolean {
  return loadedUrls.has(url);
}

export function loadTraitImage(url: string): Promise<HTMLImageElement> {
  const existing = cache.get(url);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      void (async () => {
        try {
          await img.decode();
        } catch {
          /* decode optional */
        }
        loadedUrls.add(url);
        resolve(img);
      })();
    };
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
  if (isTraitImageLoaded(primaryUrl)) {
    return cache.get(primaryUrl)!;
  }
  if (isTraitImageLoaded(fallbackUrl)) {
    return cache.get(fallbackUrl)!;
  }
  return loadTraitImage(primaryUrl).catch(() => loadTraitImage(fallbackUrl));
}

export function clearTraitImageCacheForTests(): void {
  cache.clear();
  loadedUrls.clear();
}
