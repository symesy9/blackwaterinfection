import rawManifest from "../config/traits.generated.json";
import {
  RATTOBER_FOLDER_BY_CATEGORY,
  RATTOBER_SELECTABLE_ORDER,
  type RattoberCategoryId,
} from "../config/categories";
import type { RattoberSelection } from "./compositeCanvas";
import { buildEmptySelection } from "./selectionState";

export interface RattoberTrait {
  id: string;
  name: string;
  category: RattoberCategoryId;
  file: string;
  /** Future: enabled, weight, incompatibleWith, requires */
}

export interface RattoberManifest {
  generatedAt: string;
  canvasSize: number;
  traits: Record<RattoberCategoryId, RattoberTrait[]>;
}

const manifest = rawManifest as RattoberManifest;

export function getRattoberManifest(): RattoberManifest {
  return manifest;
}

export function getTraitsForCategory(category: RattoberCategoryId): RattoberTrait[] {
  return manifest.traits[category] ?? [];
}

export type RattoberAssetVariant = "full" | "preview" | "thumb";

function assetBaseUrl(): string {
  return import.meta.env.BASE_URL.replace(/\/?$/, "/");
}

function pngBaseName(file: string): string {
  return file.replace(/\.png$/i, "");
}

/** Full 2048 PNG (export). Preview/thumb WebP when generated under _derived/. */
export function traitAssetUrl(
  category: RattoberCategoryId,
  file: string,
  variant: RattoberAssetVariant = "full",
): string {
  const folder = RATTOBER_FOLDER_BY_CATEGORY[category];
  const base = assetBaseUrl();
  if (variant === "full") {
    return `${base}assets/rattober/${folder}/${encodeURIComponent(file)}`;
  }
  const derivedFolder = variant === "thumb" ? "thumbs" : "preview";
  const webp = `${pngBaseName(file)}.webp`;
  return `${base}assets/rattober/_derived/${derivedFolder}/${folder}/${encodeURIComponent(webp)}`;
}

export function findTraitById(
  category: RattoberCategoryId,
  id: string | null | undefined,
): RattoberTrait | undefined {
  if (!id) return undefined;
  return getTraitsForCategory(category).find((t) => t.id === id);
}

export function isManifestReady(): boolean {
  return RATTOBER_SELECTABLE_ORDER.some(
    (cat) => getTraitsForCategory(cat).length > 0,
  );
}

export function totalTraitCount(): number {
  return (Object.keys(manifest.traits) as RattoberCategoryId[]).reduce(
    (sum, cat) => sum + getTraitsForCategory(cat).length,
    0,
  );
}

export function buildRandomSelection(): RattoberSelection {
  const selection = buildEmptySelection();
  for (const cat of RATTOBER_SELECTABLE_ORDER) {
    const list = getTraitsForCategory(cat);
    if (list.length === 0) {
      selection[cat] = null;
      continue;
    }
    selection[cat] = list[Math.floor(Math.random() * list.length)]!.id;
  }
  return selection;
}
