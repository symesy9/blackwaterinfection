const HOME_BASE = `${import.meta.env.BASE_URL}assets/home`;

const SITE_BASE = `${import.meta.env.BASE_URL}assets`;

export const HOME_ASSETS = {
  headerLogo: `${SITE_BASE}/blackwater-logo.png`,
  atmosphere: `${HOME_BASE}/blackwater-background-atmosphere.png`,
  fullHero: `${HOME_BASE}/blackwater-full-hero-image.png`,
  fullHeroWebp: `${HOME_BASE}/blackwater-full-hero-image.webp`,
  wordmark: `${HOME_BASE}/blackwater-hero-wordmark.png`,
  /** Retained for rollback — not used in homepage composition */
  classified: `${HOME_BASE}/blackwater-classified-files.png`,
  spill: `${HOME_BASE}/blackwater-foreground-spill.png`,
  ratChair: `${HOME_BASE}/blackwater-hero-rat-chair.png`,
  labOverlay: `${HOME_BASE}/blackwater-lab-graphics-overlay.png`,
  specimenJar: `${HOME_BASE}/blackwater-specimen-jar.png`,
} as const;
