export function getTurnstileSiteKey(): string | null {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (typeof siteKey !== "string" || !siteKey.trim()) {
    return null;
  }
  return siteKey.trim();
}

export function isTurnstileConfigured(): boolean {
  return getTurnstileSiteKey() !== null;
}
